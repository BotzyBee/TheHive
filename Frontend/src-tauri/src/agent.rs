use std::{sync::Arc, ops::Deref};
use rust_socketio::event;
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize,};
use crate::window_actions::{ check_window_exists, build_multi_view_window, navigate_webview, emit_to_specific_webview };
use tauri::{AppHandle, Manager, Listener};
use crate::socket::SocketState;
use strum_macros::{Display, EnumString};
use tauri::ipc::{Channel, InvokeResponseBody};


// [][] -- Agent State -- [][]
#[derive(Deserialize, Serialize, Debug)]
pub enum MessageType {
    Update,
    Data,
    DomResponse,
    Error,
    Request
}

#[derive(Display, EnumString, Serialize, Deserialize, Debug)]
pub enum MessageOutcome {
    Success,
    Failure,
    NotSet, // Defaults to "NotSet"
}
impl Default for MessageOutcome {
    fn default() -> Self {
        MessageOutcome::NotSet
    }
}

#[derive(Deserialize, Serialize, Debug)]
pub struct AgentJob {
    pub job_id: String,
    pub base_url: String
}
impl Default for AgentJob {
    fn default() -> Self {
        AgentJob {
            job_id: String::new(),
            base_url: String::new(),
        }
    }
}

pub struct AgentState(pub Arc<Mutex<AgentJob>>);

// [][] -- Agent Types -- [][]

#[derive(Serialize, Deserialize, Debug)]
pub struct AgentMessage<T> {
    pub job_id: String,
    pub base_url: String,
    pub message_type: MessageType,
    pub outcome: MessageOutcome,
    pub data: T,
}

// [][] -- Agent Functions -- [][]

pub async fn init_agent<T: Serialize>(app_handle: AppHandle, agent_message: AgentMessage<T>) -> Result<AgentMessage<String>, AgentMessage<String>> {
    println!("Initializing agent with message") ;
    // Update Agent State
    {
        let agent_state = app_handle.state::<AgentState>();
        let mut agent_state_lock = agent_state.0.lock().await;
        agent_state_lock.job_id = agent_message.job_id.clone();
        agent_state_lock.base_url = agent_message.base_url.clone();
    }
    println!("Agent state updated: job_id={}, base_url={}", agent_message.job_id, agent_message.base_url);

    // Check/Build window
    if !check_window_exists(app_handle.clone(), "agent-window") {
        let build = build_multi_view_window(app_handle.clone()).await;
        match build {
            Ok(_) => {
                println!("Agent window built successfully");
                // Small delay to ensure window is ready before navigation.
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            },
            Err(e) => {
                println!("Error building agent window: {}", e);
                let rtn_message: AgentMessage<String> = AgentMessage {
                    job_id: agent_message.job_id.clone(),
                    base_url: agent_message.base_url.clone(),
                    message_type: MessageType::Update,
                    outcome: MessageOutcome::Failure,
                    data: format!("Error (init_agent) : {}", e),

                };
                return Err(rtn_message);
            }
        }
    }

    println!("Agent window is ready, proceeding to navigation");
    // Navigate to URL
    let message = format!("Going to {}", agent_message.base_url);
    let target_url = tauri::WebviewUrl::External(agent_message.base_url.parse().expect("Invalid URL"));
    match navigate_webview(app_handle.clone(), target_url, "agent-webview1") {
        Ok(_) => {
            println!("Navigation successful");
            let _ = emit_to_specific_webview(
                app_handle, 
                "add-status", 
                &message, 
                "agent-webview2"
            );
        }
        Err(e) => {
            println!("Error navigating to URL: {}", e);
            let rtn_message: AgentMessage<String> = AgentMessage {
                    job_id: agent_message.job_id.clone(),
                    base_url: agent_message.base_url.clone(),
                    message_type: MessageType::Update,
                    outcome: MessageOutcome::Failure,
                    data: format!("Error (init_agent -> navigate_webview) : {}", e),

                };
            return Err(rtn_message);
        }
    }
    println!("Agent initialized and navigated successfully");
    let rtn_message: AgentMessage<String> = AgentMessage {
        job_id: agent_message.job_id.clone(),
        base_url: agent_message.base_url.clone(),
        message_type: MessageType::Update,
        outcome: MessageOutcome::Success,
        data: "Agent initialised and navigated successfully".to_string(), 
    };
    Ok(rtn_message)
}

pub async fn send_to_express<T: Serialize>(
    event: String, 
    payload: AgentMessage<T>, 
    app_handle: AppHandle
) -> Result<(), String> {
    let socket_state = app_handle.state::<SocketState>();
    let client_lock = socket_state.0.lock().await;
    let client = client_lock.as_ref().ok_or("Socket not connected")?;

    // Convert the generic T into a serde_json::Value.
    let json_payload = serde_json::to_value(payload).map_err(|e| e.to_string())?;

    client
        .emit(event, json_payload)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn trigger_dom_capture(app: AppHandle) -> Result<(), String> {
    let label = "agent-webview1";
    let webview = app.get_webview(label).ok_or("Webview not found")?;

    let script = format!(r#"
        (function() {{
            const performCapture = async () => {{
                try {{
                    const domData = document.documentElement.outerHTML;
                    
                    // Identify the correct invoke function based on Tauri version/config
                    const invoker = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;

                    if (invoker) {{
                        // The 'payload' key must match your Rust function argument name
                        await invoker('return_dom_to_express', {{ payload: domData }});
                        console.log("DOM successfully sent to Rust command.");
                    }} else {{
                        console.error("Tauri global object not found. Is 'withGlobalTauri' enabled?");
                    }}
                }} catch (err) {{
                    console.error("DOM Capture/Invoke Error:", err);
                }}
            }};

            if (document.readyState === 'complete') {{
                performCapture();
            }} else {{
                window.addEventListener('load', performCapture, {{ once: true }});
            }}
        }})()
    "#);

    webview.eval(&script).map_err(|e| e.to_string())
}