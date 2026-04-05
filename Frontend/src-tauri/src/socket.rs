#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rust_socketio::asynchronous::{ClientBuilder, Client};
use rust_socketio::Payload;
use tauri::{AppHandle, Manager, State};
use std::sync::{OnceLock, Arc};
use std::ops::Deref;
use tokio::sync::Mutex; // Changed to Tokio Mutex
use serde::{Deserialize, Serialize};
use enigo::{Enigo, Settings};
use futures_util::FutureExt; 

use crate::window_actions;
use crate::agent::{self, AgentMessage};

// [][] ---------- STATE & STATIC HANDLES ---------- [][]

// Static handle for background socket callbacks
pub static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();
// Automation State - Using Tokio Mutex to allow holding across .await
pub struct AutomationState(pub Mutex<Enigo>);

// Websocket State - Using Tokio Mutex to allow holding across .await
// Thread safe and can be shared across async contexts
pub struct SocketState(pub Arc<Mutex<Option<Client>>>);


// [][] ---------- STRUCTS & TYPES ---------- [][]

#[derive(Deserialize, Debug)]
struct TestPayload {
    message: String,
}


// [][] ---------- TAURI COMMANDS ---------- [][]

#[tauri::command]
async fn return_dom_to_express(payload: String){
    println!("Received response from Agent - returning to Express");
    let app_handle: &AppHandle = APP_HANDLE.get().expect("App handle not set");
    let agent_state: State<'_, agent::AgentState> = app_handle.state::<agent::AgentState>();
    let agent_state_lock: tokio::sync::MutexGuard<'_, agent::AgentJob> = agent_state.0.lock().await;
    let agent_state_data = agent_state_lock.deref().clone();
    let message: AgentMessage<String> = agent::AgentMessage {
        job_id: agent_state_data.job_id.clone(),
        base_url: agent_state_data.base_url.clone(),
        message_type: agent::MessageType::DomResponse,
        data: payload.clone(),
    };
    agent::send_to_express("web-agent-response".to_string(), message, APP_HANDLE.get().unwrap().clone()).await.unwrap();
}


// [][] ---------- SETUP WEB SOCKET & APP ---------- [][]

pub fn start_socket() {
    // 1. Initialize State containers with Tokio's Mutex
    let automation_state = AutomationState(Mutex::new(
        Enigo::new(&Settings::default()).expect("Failed to initialize Enigo")
    ));
    let agent_state = agent::AgentState(Arc::new(Mutex::new(agent::AgentJob::default())));
    let socket_state_inner = Arc::new(Mutex::new(None));
    let socket_state_clone = socket_state_inner.clone();

    tauri::Builder::default()
        .manage(automation_state)
        .manage(agent_state)
        .setup(move |app| {
            let handle = app.handle().clone();
            let _ = APP_HANDLE.set(handle.clone());

            // 2. Spawn the socket connection in Tauri's async runtime
            tauri::async_runtime::spawn(async move {
                let socket_result = ClientBuilder::new("http://localhost:3000")

                // Opens webagent window and navigates to URL provided by Express
                .on("start-web-agent", |payload: Payload, client| {
                    async move {
                        if let Payload::Text(values) = payload {
                            if let Some(first_val) = values.get(0) {
                                if let Ok(data) = serde_json::from_value::<agent::AgentMessage<serde_json::Value>>(first_val.clone()) {
                                    if let Some(h) = APP_HANDLE.get() {
                                        let h_clone = h.clone();

                                        // Use Tauri's async runtime to spawn the task (dont block the socket listener)
                                        tauri::async_runtime::spawn(async move {
                                            match agent::init_agent(h_clone.clone(), data).await {
                                                Ok(v) => {
                                                    let json_payload = serde_json::to_value(v).map_err(|e| e.to_string()).unwrap();
                                                    client
                                                        .emit("web-agent-response", json_payload)
                                                        .await
                                                        .map_err(|e| e.to_string()).unwrap();
                                                },
                                                Err(e) => eprintln!("Error (start-web-agent) : {}", e),
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }.boxed()
                })
                
                // Follow on actions
                .on("capture-dom", |payload: Payload, client| {
                    async move {
                        if let Payload::Text(values) = payload {
                            if let Some(first_val) = values.get(0) {
                                if let Ok(data) = serde_json::from_value::<agent::AgentMessage<serde_json::Value>>(first_val.clone()) {
                                    if let Some(h) = APP_HANDLE.get() {
                                        let h_clone = h.clone();

                                        // Use Tauri's async runtime to spawn the task (dont block the socket listener)
                                        tauri::async_runtime::spawn(async move {
                                            match window_actions::trigger_agent_dom_capture(h_clone.clone()) {
                                                Ok(_) => {
                                                    let message = format!("Triggered DOM capture for job {}", data.job_id);
                                                    let response = agent::AgentMessage {
                                                        job_id: data.job_id.clone(),
                                                        base_url: data.base_url.clone(),
                                                        message_type: agent::MessageType::Update,
                                                        data: message,
                                                    };
                                                    let json_payload = serde_json::to_value(response).map_err(|e| e.to_string()).unwrap();
                                                    client
                                                        .emit("web-agent-response", json_payload)
                                                        .await
                                                        .map_err(|e| e.to_string()).unwrap();
                                                },
                                                Err(e) => eprintln!("Error (capture-dom) : {}", e),
                                            }
                                        });
                                    }
                                }
                            }
                        }
                    }.boxed()
                })

                .on("take-action", |payload: Payload, client| {
                    async move {
                        if let Payload::Text(values) = payload {
                            if let Some(first_val) = values.get(0) {
                                if let Ok(data) = serde_json::from_value::<agent::AgentMessage<serde_json::Value>>(first_val.clone()) {
                                    if let Some(h) = APP_HANDLE.get() {
                                        let h_clone = h.clone();

                                        // Use Tauri's async runtime to spawn the task (dont block the socket listener)
                                        tauri::async_runtime::spawn(async move {
                                            println!("Received take-action command for job {}: {:?}", data.job_id, data.data);
                                            // TODO!
                                        });
                                    }
                                }
                            }
                        }
                    }.boxed()
                }) // Placeholder for the actual handler
                
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
            return_dom_to_express
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}