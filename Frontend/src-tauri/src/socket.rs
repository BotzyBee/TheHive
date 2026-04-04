#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rust_socketio::asynchronous::{ClientBuilder, Client};
use rust_socketio::Payload;
use tauri::{AppHandle, State};
use std::sync::{OnceLock, Arc};
use tokio::sync::Mutex; // Changed to Tokio Mutex
use serde::{Deserialize, Serialize};
use enigo::{Enigo, Settings};
use futures_util::FutureExt; 

use crate::window_actions;


// Static handle for background socket callbacks
static APP_HANDLE: OnceLock<AppHandle> = OnceLock::new();

// [][] ---------- STRUCTS & TYPES ---------- [][]

#[derive(Deserialize, Debug)]
struct StartAgentPayload {
    url: String,
}

#[derive(Deserialize, Serialize, Debug)]
struct AgentResponsePayload {
    status: String, 
    data: String
}

#[derive(Deserialize, Debug)]
struct AgentAction {
    action: String,
    x: i32,
    y: i32,
    value: Option<String>,
}

#[derive(Deserialize, Debug)]
struct AgentActionPayload {
    //actions: Vec<AgentAction>,
    action: String,
    data: String,
}

#[derive(Deserialize, Debug)]
struct TestPayload {
    message: String,
}

// Automation State - Using Tokio Mutex to allow holding across .await
pub struct AutomationState(pub Mutex<Enigo>);

// Websocket State - Using Tokio Mutex to allow holding across .await
pub struct SocketState(pub Arc<Mutex<Option<Client>>>);

// [][] ---------- TAURI COMMANDS ---------- [][]

#[tauri::command]
async fn send_to_express(
    event: String, 
    payload: String, 
    socket_state: State<'_, SocketState>
) -> Result<(), String> {
    // We use .lock().await because this is a tokio::sync::Mutex
    let client_lock = socket_state.0.lock().await;
    let client = client_lock.as_ref().ok_or("Socket not connected")?;

    // Emit the data to Express
    client
        .emit(event, serde_json::json!({ "data": payload }))
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn print_agent_response(payload: String){
    println!("Received response from Agent: {}", payload);
}


// [][] ---------- SETUP WEB SOCKET & APP ---------- [][]

pub fn start_socket() {
    // 1. Initialize State containers with Tokio's Mutex
    let automation_state = AutomationState(Mutex::new(
        Enigo::new(&Settings::default()).expect("Failed to initialize Enigo")
    ));

    let socket_state_inner = Arc::new(Mutex::new(None));
    let socket_state_clone = socket_state_inner.clone();

    tauri::Builder::default()
        .manage(automation_state)
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
                                if let Ok(data) = serde_json::from_value::<StartAgentPayload>(first_val.clone()) {
                                    if let Some(h) = APP_HANDLE.get() {
                                        
                                        let message = format!("Going to {}", data.url.clone());

                                        // check window exists, if not create it, if it does navigate and show it
                                        if !window_actions::check_window_exists(h.clone(), "agent-window") {
                                           let _ = window_actions::build_multi_view_window(h.clone()).await; 
                                        } 

                                        window_actions::navigate_webview(
                                            h.clone(), 
                                            tauri::WebviewUrl::External(data.url.parse().expect("Invalid URL")), 
                                            "agent-webview1"
                                        ).await.expect("Failed to navigate webview");
                                    }
                                }
                            }
                        }
                    }.boxed() 
                })
                
                // Follow on actions
                .on("test2", |payload: Payload, client| {
                    async move {
                        if let Payload::Text(values) = payload {
                            if let Some(first_val) = values.get(0) {
                                if let Ok(data) = serde_json::from_value::<TestPayload>(first_val.clone()) {
                                 if let Some(h) = APP_HANDLE.get() {
                                    println!("Received 'test2' event with payload: {:?}", data);
                                    window_actions::emit_to_specific_webview(h.clone(), "add-status", &data.message, "agent-webview2").unwrap();
                                    window_actions::emit_to_specific_webview(h.clone(), "request-dom-capture", "", "agent-webview1").unwrap();
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
            send_to_express,
            print_agent_response
            //get_external_source
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}