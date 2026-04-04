use enigo::{Mouse, Keyboard, Coordinate, Button, Direction};
use tauri::{
    AppHandle, Manager, State
};
use super::socket::AutomationState;


pub async fn perform_automation_impl(
    state: State<'_, AutomationState>,
    handle: AppHandle,
    action: String,
    x: i32,
    y: i32,
    value: Option<String>
) -> Result<(), String> {
    let mut enigo = state.inner().0.lock().await;
    let window = handle.get_webview_window("agent-container").ok_or("Window not active")?;
    let win_pos = window.outer_position().map_err(|e| e.to_string())?;
    
    let target_x = win_pos.x + x;
    let target_y = win_pos.y + y + 30;

    match action.as_str() {
        "click" => {
            let _ = enigo.move_mouse(target_x, target_y, Coordinate::Abs);
            let _ = enigo.button(Button::Left, Direction::Click);
        },
        "type" => {
            if let Some(text) = value {
                let _ = enigo.move_mouse(target_x, target_y, Coordinate::Abs);
                let _ = enigo.button(Button::Left, Direction::Click);
                let _ = enigo.text(&text);
            }
        },
        _ => return Err("Unknown action".into()),
    }
    Ok(())
}