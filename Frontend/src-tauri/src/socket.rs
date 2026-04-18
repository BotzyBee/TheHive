#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rust_socketio::asynchronous::{ClientBuilder, Client};
use rust_socketio::Payload;
use tauri::{AppHandle, Manager, State};
use std::sync::{OnceLock, Arc};
use std::ops::Deref;
use tokio::sync::{Mutex, oneshot}; 
use futures_util::FutureExt; 
use crate::agent::{self, AgentMessage};
use crate::page_automation;
use crate::window_actions;

// [][] ---------- STATE & STATIC HANDLES ---------- [][]

// Static handle for background socket callbacks
pub static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

// Websocket State - Using Tokio Mutex to allow holding across .await
// Thread safe and can be shared across async contexts
pub struct SocketState(pub Arc<Mutex<Option<Client>>>);

pub struct MetricsChannel(pub Arc<Mutex<Option<oneshot::Sender<page_automation::ElementMetrics>>>>);

// [][] ---------- TAURI COMMANDS ---------- [][]



#[tauri::command]
pub async fn submit_metrics(
    metrics: page_automation::ElementMetrics,
    state: tauri::State<'_, MetricsChannel>,
) -> Result<(), String> {
    let mut lock = state.0.lock().await;
    if let Some(tx) = lock.take() {
        let _ = tx.send(metrics);
    }
    Ok(())
}

#[tauri::command]
async fn return_dom_to_express(payload: String){
    let app_handle: &AppHandle = APP_HANDLE.get().expect("App handle not set");
    let agent_state: State<'_, agent::AgentState> = app_handle.state::<agent::AgentState>();
    let agent_state_lock: tokio::sync::MutexGuard<'_, agent::AgentJob> = agent_state.0.lock().await;
    let agent_state_data = agent_state_lock.deref();
    let message: AgentMessage<String> = agent::AgentMessage {
        job_id: agent_state_data.job_id.clone(),
        base_url: agent_state_data.base_url.clone(),
        outcome: agent::MessageOutcome::Success,
        message_type: agent::MessageType::DomResponse,
        data: payload.clone(),
    };
    println!("Emitting page content message to Express. Len : {}", message.data.len());
    agent::send_to_express("page-content-response".to_string(), message, APP_HANDLE.get().unwrap().clone()).await.unwrap();
}

use std::fs;
use std::path::Path;

#[tauri::command]
async fn list_directory_contents(path: String) -> Result<Vec<String>, String> {
    let target_path = if path.is_empty() { "." } else { &path };
    
    let entries = fs::read_dir(target_path)
        .map_err(|e| e.to_string())?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path().display().to_string())
        .collect();

    Ok(entries)
}


// [][] ---------- SETUP WEB SOCKET & APP ---------- [][]

pub fn start_socket() {
    // Initialise shared states
    let agent_state = agent::AgentState(Arc::new(Mutex::new(agent::AgentJob::default())));
    let socket_state_inner = Arc::new(Mutex::new(None));
    let socket_state_clone = socket_state_inner.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(agent_state)
        .manage(MetricsChannel(Arc::new(Mutex::new(None))))
        .setup(move |app| {
            let handle = app.handle().clone();
            let _ = APP_HANDLE.set(handle.clone());

            // Spawn the socket connection in Tauri's async runtime
            tauri::async_runtime::spawn(async move {
                let socket_result = ClientBuilder::new("http://localhost:3000")

                // Opens webagent window and navigates to URL provided by Express
                .on("start-web-agent", |payload: Payload, client: Client| {
                    println!("Starting web agent");
                    async move {
                        let values = match payload {
                            Payload::Text(v) => v,
                            _ => return, // don't need to return anything, JS call will time out. 
                        };

                        let first_val = match values.get(0) {
                            Some(v) => v,
                            None => return, // don't need to return anything, JS call will time out.
                        };

                        let data: agent::AgentMessage<serde_json::Value> = match serde_json::from_value(first_val.clone()) {
                            Ok(d) => d,
                            Err(_) => return, // don't need to return anything, JS call will time out.
                        };

                        if let Some(h) = APP_HANDLE.get() {
                            tauri::async_runtime::spawn(async move {
                                let call = agent::init_agent(h.clone(), data).await.unwrap();
                                let json_payload = serde_json::to_value(call).unwrap();
                                let _ = client.emit("start-agent-response", json_payload).await;
                            });
                        }
                    }.boxed()
                })
                
                // Follow on actions
                .on("capture-dom", |_payload: Payload, _client| {
                    print!("Received 'capture-dom' command");
                    async move {
                            if let Some(h) = APP_HANDLE.get() {
                            let _ = window_actions::emit_to_specific_webview(
                                &h.clone(), 
                                "add-status", 
                                "👀 Having a look...", 
                                "agent-webview2"
                            );
                            // Use Tauri's async runtime to spawn the task (dont block the socket listener)
                            tauri::async_runtime::spawn(async move {
                                // Evals code in browser which captures the dom
                                let _ = agent::trigger_dom_capture(&h.clone()).await.unwrap();
                                // Don't need to retun anything. JS function will time-out if Rust errors.
                                // Response sent via the 'return_dom_to_express' command when DOM capture is complete. 
                            });
                        }
                    }.boxed()
                })

                .on("take-action", |payload: Payload, _client| {
                    async move {
                        if let Payload::Text(values) = payload {
                            if let Some(first_val) = values.get(0) {
                                if let Ok(data) = serde_json::from_value(first_val.clone()) as Result<page_automation::WebActionPayload, _> {
                                    if let Some(h) = APP_HANDLE.get() {
                                        
                                        // Spawn the task on Tauri's async runtime
                                        tauri::async_runtime::spawn(async move {
                                            println!("Received take-action command for job: Len of actions: {}", data.actions.len());

                                            // FIX: Directly .await the async function. 
                                            // Do NOT use block_on inside an existing async runtime.
                                            let res = page_automation::execute_web_actions(
                                                h.clone(), 
                                                "agent-webview1", 
                                                data.actions
                                            ).await;

                                            match res {
                                                Ok(_) => {
                                                    println!("Actions executed successfully");
                                                    let message = agent::AgentMessage {
                                                        job_id: data.job_id.clone(),
                                                        base_url: "not-available".to_string(),
                                                        message_type: agent::MessageType::Update,
                                                        outcome: agent::MessageOutcome::Success,
                                                        data: "Actions executed successfully".to_string(), 
                                                    };
                                                    
                                                    // Await the response back to your express server
                                                    let _ = agent::send_to_express("take-action-result".to_string(), message, h.clone()).await;
                                                },
                                                Err(e) => {
                                                    eprintln!("Error executing actions: {}", e);
                                                    let message = agent::AgentMessage {
                                                        job_id: data.job_id.clone(),
                                                        base_url: "not-available".to_string(),
                                                        message_type: agent::MessageType::Update,
                                                        outcome: agent::MessageOutcome::Failure,
                                                        data: format!("Error executing actions: {}", e),
                                                    };
                                                    
                                                    let _ = agent::send_to_express("take-action-result".to_string(), message, h.clone()).await;
                                                }
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }.boxed()
                })
                
                .connect()
                .await; // Async connect

                match socket_result {
                    Ok(socket) => {
                        // Store the connected client using async lock
                        let mut lock = socket_state_clone.lock().await;
                        *lock = Some(socket);
                        println!("Socket.io connected successfully.");
                    }
                    Err(e) => {
                        eprintln!("Socket.io connection failed: {}", e);
                    }
                }
            });

            Ok(())
        })
        .manage(SocketState(socket_state_inner)) // Manage the socket state
        .invoke_handler(tauri::generate_handler![
            return_dom_to_express,
            submit_metrics,
            list_directory_contents
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}