use rand::RngExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle};
use tokio::time::{sleep, Duration};
use crate::window_actions::{eval_in_specific_webview, emit_to_specific_webview};

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
    /// Generates the raw JavaScript snippet for instant DOM manipulation.
    pub fn to_js_snippet(&self) -> Option<String> {
        match self.action_type.as_str() {
            "scroll" => {
                let x = self.x.unwrap_or(0);
                let y = self.y.unwrap_or(0);
                // We use scrollBy for relative movement, or scrollTo for absolute. 
                // Using scrollBy here as it's common for "scroll down a bit" actions.
                Some(format!(
                    r#"window.scrollBy({{ top: {}, left: {}, behavior: 'smooth' }});"#,
                    y, x
                ))
            }

            "scroll_into_view" => {
                let selector = self.selector.as_ref()?;
                let safe_sel = serde_json::to_string(selector).unwrap();
                Some(format!(
                    r#"(() => {{
                        const el = document.querySelector({});
                        if (el) {{ 
                            el.scrollIntoView({{ behavior: 'smooth', block: 'center' }}); 
                        }}
                    }})();"#,
                    safe_sel
                ))
            }

            "click" => {
                let selector = self.selector.as_ref()?;
                let safe_selector = serde_json::to_string(selector).unwrap();
                Some(format!(
                    r#"(() => {{
                        const el = document.querySelector({});
                        if (el) {{ el.click(); }} 
                        else {{ console.warn('Action Failed: Selector not found:', {}); }}
                    }})();"#,
                    safe_selector, safe_selector
                ))
            }
            "clear_field" => {
                let selector = self.selector.as_ref()?;
                let safe_sel = serde_json::to_string(selector).unwrap();
                Some(format!(
                    r#"(() => {{
                        const el = document.querySelector({});
                        if (!el) return;
                        el.focus();
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        if (setter) {{ setter.call(el, ''); }}
                        else {{ el.value = ''; }}
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        el.blur();
                    }})();"#,
                    safe_sel
                ))
            }
            "type_text" => {
                // If delay_ms exists, Rust handles character-by-character typing.
                if self.delay_ms.is_some() {
                    return None;
                }
                
                let selector = self.selector.as_ref()?;
                let text = self.text.as_ref()?;
                let safe_sel = serde_json::to_string(selector).unwrap();
                let safe_text = serde_json::to_string(text).unwrap();

                Some(format!(
                    r#"(() => {{
                        const el = document.querySelector({});
                        if (!el) return;
                        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                        if (setter) {{ setter.call(el, {}); }}
                        else {{ el.value = {}; }}
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    }})();"#,
                    safe_sel, safe_text, safe_text
                ))
            }
            _ => None, // "wait" or unknown types return None
        }
    }

    pub fn single_char_js(selector: &str, char: char, is_first: bool, is_last: bool) -> String {
        let safe_sel = serde_json::to_string(selector).unwrap();
        let safe_char = serde_json::to_string(&char.to_string()).unwrap();

        format!(
            r#"(() => {{
                const el = document.querySelector({});
                if (!el) return;
                if ({}) el.focus();
                el.dispatchEvent(new KeyboardEvent('keydown', {{ key: {}, bubbles: true }}));
                const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                if (setter) {{ setter.call(el, el.value + {}); }}
                else {{ el.value += {}; }}
                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                el.dispatchEvent(new KeyboardEvent('keyup', {{ key: {}, bubbles: true }}));
                if ({}) el.blur();
            }})();"#,
            safe_sel, is_first, safe_char, safe_char, safe_char, safe_char, is_last
        )
    }
}


pub async fn execute_web_actions(
    app: AppHandle,
    webview_label: &str,
    actions: Vec<WebAction>,
) -> Result<(), String> {
    for action in actions {
        println!("Executing action: {:?}", action.action_type);
        match action.action_type.as_str() {
            "type_text" => {
                let selector = action.selector.as_deref().ok_or("Missing selector for type_text")?;
                let text = action.text.as_deref().ok_or("Missing text for type_text")?;
                let base_delay = action.delay_ms.unwrap_or(20);

                // Update sidebar status
                let _ = emit_to_specific_webview(
                    &app, 
                    "add-status", 
                    "Typing text...", 
                    "agent-webview2"
                );

                // HUMAN MODE
                let chars: Vec<char> = text.chars().collect();
                let len = chars.len();

                for (i, &c) in chars.iter().enumerate() {
                    let js = WebAction::single_char_js(selector, c, i == 0, i == len - 1);
                    eval_in_specific_webview(&app, &js, webview_label)?;

                    let jitter = rand::rng().random_range(0..250);
                    sleep(Duration::from_millis(base_delay + jitter)).await;
                }

                // // ROBOT MODE (Instant)
                // if let Some(js) = action.to_js_snippet() {
                //     eval_in_specific_webview(&app, &js, webview_label)?;
                //     sleep(Duration::from_millis(50)).await;
                // }
                
            }

           "wait" => {
                // Update sidebar status
                let _ = emit_to_specific_webview(
                    &app, 
                    "add-status", 
                    "Waiting a little moment...", 
                    "agent-webview2"
                );
                let ms = action.delay_ms.ok_or("Wait action requires delay_ms")?;
                sleep(Duration::from_millis(ms)).await;
            }

            "click" => {
                // update sidebar status
                let _ = emit_to_specific_webview(
                    &app, 
                    "add-status", 
                    "Clicking element...", 
                    "agent-webview2"
                );
                if let Some(js) = action.to_js_snippet() {
                    eval_in_specific_webview(&app, &js, webview_label)?;
                    
                    // Give the browser time to finish the smooth scroll animation 
                    // or DOM update before the next action.
                    let buffer = if action.action_type.contains("scroll") { 300 } else { 50 };
                    sleep(Duration::from_millis(buffer)).await;
                }
            }

             "clear_field" => {
                 // update sidebar status
                let _ = emit_to_specific_webview(
                    &app, 
                    "add-status", 
                    "Clearing input field...", 
                    "agent-webview2"
                );
                if let Some(js) = action.to_js_snippet() {
                    eval_in_specific_webview(&app, &js, webview_label)?;
                    
                    // Give the browser time to finish the smooth scroll animation 
                    // or DOM update before the next action.
                    let buffer = if action.action_type.contains("scroll") { 300 } else { 50 };
                    sleep(Duration::from_millis(buffer)).await;
                }
             }

            "scroll" | "scroll_into_view" => {
            // update sidebar status
                let _ = emit_to_specific_webview(
                    &app, 
                    "add-status", 
                    "Doing a little scroll...", 
                    "agent-webview2"
                );
                if let Some(js) = action.to_js_snippet() {
                    eval_in_specific_webview(&app, &js, webview_label)?;
                    
                    // Give the browser time to finish the smooth scroll animation 
                    // or DOM update before the next action.
                    let buffer = if action.action_type.contains("scroll") { 300 } else { 50 };
                    sleep(Duration::from_millis(buffer)).await;
                }
            }
            _ => return Err(format!("Unknown action type: {}", action.action_type)),
        }
    sleep(Duration::from_millis(502)).await;
    }
    Ok(())
}