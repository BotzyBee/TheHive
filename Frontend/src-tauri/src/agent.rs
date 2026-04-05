use std::{f32::consts::E, sync::Arc};
use tokio::sync::Mutex;
use serde::{Deserialize, Serialize};
use crate::window_actions::{ check_window_exists, build_multi_view_window, navigate_webview, emit_to_specific_webview };
use tauri::{AppHandle, Manager, State};
use crate::socket::SocketState;

// [][] -- Agent State -- [][]
#[derive(Deserialize, Serialize, Debug)]
pub enum MessageType {
    Update,
    Data,
    DomResponse,
    Error,
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
    pub data: T,
}

// [][] -- Agent Functions -- [][]

pub async fn init_agent<T: Serialize>(app_handle: AppHandle, agent_message: AgentMessage<T>) -> Result<AgentMessage<String>, String> {
    
    // Update Agent State
    {
        let agent_state = app_handle.state::<AgentState>();
        let mut agent_state_lock = agent_state.0.lock().await;
        agent_state_lock.job_id = agent_message.job_id.clone();
        agent_state_lock.base_url = agent_message.base_url.clone();
    }

    // Check/Build window
    if !check_window_exists(app_handle.clone(), "agent-window") {
        let build = build_multi_view_window(app_handle.clone()).await;
        match build {
            Ok(_) => {
                // Small delay to ensure window is ready before navigation.
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            },
            Err(e) => {
                let er = format!("Error (init_agent) : {}", e);
                return Err(er);
            }
        }
    }

    // Navigate to URL
    let message = format!("Going to {}", agent_message.base_url);
    let target_url = tauri::WebviewUrl::External(agent_message.base_url.parse().expect("Invalid URL"));
    match navigate_webview(app_handle.clone(), target_url, "agent-webview1") {
        Ok(_) => {
            let _ = emit_to_specific_webview(
                app_handle, 
                "add-status", 
                &message, 
                "agent-webview2"
            );
        }
        Err(e) => return Err(format!("Error (init_agent -> navigate_webview) : {}", e)),
    }
    let rtn_message: AgentMessage<String> = AgentMessage {
        job_id: agent_message.job_id.clone(),
        base_url: agent_message.base_url.clone(),
        message_type: MessageType::Update,
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