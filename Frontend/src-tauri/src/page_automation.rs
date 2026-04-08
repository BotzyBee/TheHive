use serde::{Deserialize, Serialize};
use tauri::{AppHandle,};
use tokio::time::{sleep, Duration};
use crate::window_actions::{eval_in_specific_webview, emit_to_specific_webview, show_and_center_window};
use tauri::{ Manager};
use tokio::sync::oneshot;
use enigo::{Enigo, Settings, Mouse, Keyboard, Button, Coordinate, Direction};

use crate::socket::{MetricsChannel};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElementMetrics {
    pub found: bool,
    pub visible: bool,
    pub obstructed: bool,
    pub off_screen: bool,
    pub center_x: f64, // Viewport X
    pub center_y: f64, // Viewport Y
    pub error_msg: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebActionPayload {
    pub job_id: String,
    pub actions: Vec<WebAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct WebAction {
    pub action_type: String, // "click", "type_text", "scroll", "scroll_into_view", etc.
    pub selector: Option<String>,
    pub text: Option<String>,
    pub delay_ms: Option<u64>,
    pub x: Option<i32>,
    pub y: Option<i32>,
}

impl WebAction {
    pub fn get_metrics_js(&self) -> Option<String> {
        let selector = self.selector.as_ref()?;
        let safe_sel = serde_json::to_string(selector).unwrap();

        Some(format!(
            r#"(() => {{
                const el = document.querySelector({});
                let metrics = {{ 
                    found: !!el, visible: false, obstructed: false, off_screen: false, 
                    center_x: 0, center_y: 0, error_msg: null 
                }};
                
                if (el) {{
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    metrics.visible = style.display !== 'none' && style.visibility !== 'hidden';
                    metrics.center_x = rect.left + (rect.width / 2);
                    metrics.center_y = rect.top + (rect.height / 2);
                    metrics.off_screen = (rect.bottom < 0 || rect.top > window.innerHeight);

                    if (!metrics.off_screen && metrics.visible) {{
                        const topEl = document.elementFromPoint(metrics.center_x, metrics.center_y);
                        metrics.obstructed = topEl !== null && topEl !== el && !el.contains(topEl);
                    }}
                }}

                const invoker = window.__TAURI__?.core?.invoke || window.__TAURI__?.invoke;
                if (invoker) {{
                    invoker('submit_metrics', {{ metrics: metrics }});
                }}
            }})();"#,
            safe_sel
        ))
    }

    /// Dedicated method to scroll this element into the center of the viewport,
    /// regardless of what the primary action_type is.
    pub fn get_scroll_into_view_js(&self) -> Option<String> {
        let selector = self.selector.as_ref()?;
        let safe_sel = serde_json::to_string(selector).unwrap();
        
        Some(format!(
            "document.querySelector({}).scrollIntoView({{behavior:'smooth', block:'center', inline:'center'}});", 
            safe_sel
        ))
    }

    pub fn to_js_snippet(&self) -> Option<String> {
        let selector = self.selector.as_ref()?;
        let safe_sel = serde_json::to_string(selector).unwrap();

        match self.action_type.as_str() {
            "scroll" | "scroll_into_view" => Some(format!(
                "document.querySelector({}).scrollIntoView({{behavior:'smooth',block:'center'}});", 
                safe_sel
            )),
            "clear_field" => Some(format!(
                "let el=document.querySelector({}); if(el){{el.value=''; el.dispatchEvent(new Event('input',{{bubbles:true}}));}}", 
                safe_sel
            )),
            _ => None
        }
    }
}
    
    
pub async fn execute_web_actions(
    app: AppHandle,
    webview_label: &str,
    actions: Vec<WebAction>,
) -> Result<(), String> {
    let window_label = "agent-window";

    // Ensure the window is ready for interaction
    focus_and_center_window(&app, window_label)?;
    
    // Small pause to let the OS handle the window transition/focus
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;

    for action in actions {
        println!("Executing action: {:?}", action.action_type);
        
        // Update UI/Status webview if applicable
        update_sidebar_status(&app, &action.action_type);
        sleep(Duration::from_millis(333)).await;

        // --- STEP 1: Sensory Check & Auto-Scroll Loop ---
        let mut metrics: Option<ElementMetrics> = None;
        
        // We try up to 2 times: once initially, and once more if we had to scroll
        for attempt in 0..2 {
            println!("Gathering metrics (Attempt {}) for selector: {:?}", attempt + 1, action.selector);
            
            if let Some(js) = action.get_metrics_js() {
                let (tx, rx) = oneshot::channel();
                
                // 1. Place the sender into the global state so the 'submit_metrics' 
                // command can find it when the JS invokes.
                {
                    let metrics_channel = app.state::<MetricsChannel>().inner();
                        let mut lock = metrics_channel.0.lock().await; 
                        *lock = Some(tx);
                } // Lock is dropped here so the command can access it

                // 2. Inject and execute the JS
                eval_in_specific_webview(&app, &js, webview_label)?;

                // 3. Wait for the JS to call the 'submit_metrics' command
                // We use a 3-second timeout to prevent the loop from hanging forever
                match tokio::time::timeout(Duration::from_secs(3), rx).await {
                    Ok(Ok(m)) => {
                        if !m.found {
                            println!("Element not found in DOM.");
                            break; 
                        }
                        if !m.visible {
                            println!("Element found but not visible (CSS).");
                            break;
                        }
                        
                        if m.off_screen {
                            println!("Element off screen. Attempting auto-scroll...");
                            // FIXED: Use the dedicated scroll JS, ignoring the action_type
                            if let Some(scroll_js) = action.get_scroll_into_view_js() {
                                eval_in_specific_webview(&app, &scroll_js, webview_label)?;
                            }
                            // Wait for smooth scrolling to finish before re-checking coordinates
                            sleep(Duration::from_millis(800)).await;
                            continue; 
                        }

                        metrics = Some(m);
                        break; // Coordinates are valid, proceed to execution
                    }
                    Ok(Err(_)) => {
                        println!("Channel closed before receiving metrics.");
                        break;
                    }
                    Err(_) => {
                        println!("Timeout waiting for element metrics from JS.");
                        // Clean up the sender if the timeout hit
                        let metrics_channel = app.state::<MetricsChannel>().inner();
                        let mut lock = metrics_channel.0.lock().await;
                        *lock = None;
                        break;
                    }
                }
            } else {
                break; // No JS generated for this action type
            }
        }

        println!("Final metrics for execution: {:?}", metrics);

        // --- STEP 2: Physical Execution ---
        if let Some(m) = metrics {
            // Calculate absolute screen coordinates based on window position and DPI scale
            let (screen_x, screen_y) = {
                let window = app.get_window(window_label).ok_or("Window not found")?;
                let win_pos = window.outer_position().map_err(|e| e.to_string())?;
                let scale_factor = window.scale_factor().map_err(|e| e.to_string())?;
                (
                    win_pos.x as f64 + (m.center_x * scale_factor) + 12.0, // Adding a small offset to ensure we click slightly inside the element
                    win_pos.y as f64 + (m.center_y * scale_factor) + 33.0 // Adding offset for typical browser UI (address bar, bookmarks)
                )
            };

            match action.action_type.as_str() {
                "click" | "type_text" | "clear_field" => {
                    println!("Moving mouse to ({}, {}) and clicking", screen_x, screen_y);
                    
                    // Mouse Click Logic
                    {
                        let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
                        enigo.move_mouse(screen_x as i32, screen_y as i32, Coordinate::Abs).map_err(|e| e.to_string())?;
                        sleep(Duration::from_millis(203)).await;
                        enigo.button(Button::Left, Direction::Click).map_err(|e| e.to_string())?;
                    }
                    
                    // Keyboard Logic for Typing
                    if action.action_type == "type_text" {
                        println!("Typing text: {}", action.text.as_deref().unwrap_or_default());
                        sleep(Duration::from_millis(412)).await;
                        let text = action.text.clone().unwrap_or_default();
                        
                        for c in text.chars() {
                            {
                                let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
                                enigo.text(&c.to_string()).map_err(|e| e.to_string())?;
                            }
                            // Human-like jitter between keystrokes
                            let jitter = rand::random_range(60..420);
                            sleep(Duration::from_millis(jitter)).await;
                        }
                    } else if action.action_type == "clear_field" {
                        println!("Clearing field via JS execution");
                        sleep(Duration::from_millis(412)).await;
                        if let Some(js) = action.to_js_snippet() {
                            eval_in_specific_webview(&app, &js, webview_label)?;
                        }
                    }
                }
                _ => {
                    println!("Action type {} handled via metrics but no physical logic defined.", action.action_type);
                }
            }
        } else if action.action_type == "wait" || action.action_type == "scroll" {
            // Handle actions that do NOT require element metrics (targetless actions)
            println!("Executing targetless action: {}", action.action_type);
            if let Some(js) = action.to_js_snippet() {
                if action.action_type == "scroll" {
                    eval_in_specific_webview(&app, &js, webview_label)?;
                    sleep(Duration::from_millis(500)).await;
                } else {
                    let ms = action.delay_ms.unwrap_or(1000);
                    sleep(Duration::from_millis(ms)).await;
                }
            }
        } else {
            println!("Action skipped: No metrics found and not a targetless action.");
        }

        // Post-action "Human" delay to prevent bot detection and allow UI updates
        let final_delay = rand::random_range(400..700);
        sleep(Duration::from_millis(final_delay)).await;
    }

    Ok(())
}

fn update_sidebar_status(app: &AppHandle, action_type: &str) {
    let mut message = "";
    match action_type {
        "click" => message = "🖱️ Clicking Element...",
        "type_text" => message = "⌨️ Typing Text...",
        "clear_field" => message = "🧹 Clearing Field..",
        "scroll" => message = "🎯 Scrolling...",
        "wait" => message = "⏳ Waiting...",
        _ => {}
     }

    let _ = emit_to_specific_webview(
        app, 
        "add-status", 
        message, 
        "agent-webview2"
    );
}

pub fn focus_and_center_window(app: &AppHandle, window_label: &str) -> Result<(), String> {
    println!("Focusing and centering window: {}", window_label);
    let window = app.get_window(window_label) // Use get_window for Tauri 2.0
        .ok_or_else(|| format!("Window label '{}' not found", window_label))?;

    // 1. Make sure it's visible
    window.show().map_err(|e| e.to_string())?;
    
    // 2. Bring it to the front and give it OS focus
    window.set_focus().map_err(|e| e.to_string())?;
    
    // 3. Center it (optional, but keeps coordinates predictable)
    window.center().map_err(|e| e.to_string())?;

    Ok(())
}