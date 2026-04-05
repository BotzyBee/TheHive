use tauri::{LogicalPosition, LogicalSize, WebviewUrl, AppHandle, Manager, Emitter};

pub async fn build_multi_view_window(app: tauri::AppHandle) -> Result<(), String> {
    let width = 1200.;
    let height = 700.;

    // Preload script to allow capturing DOM and sending it back to Rust via a custom event
    let preload_js = r#"
    (function() {      
        // Listen for a specific secret event name dispatched by Rust
        document.addEventListener('__HIVE_CAPTURE_DOM__', function() {    

            // __TAURI_INTERNALS__ is always available, even with GlobalTauri = false
            if (window.__TAURI_INTERNALS__) {
                window.__TAURI_INTERNALS__.invoke('return_dom_to_express', {
                    payload: document.documentElement.outerHTML
                });
            } else {
                console.error("Critical: Internals not found. (Hive error code 1001)");
            }
        });
    })();
    "#;

    let window = tauri::window::WindowBuilder::new(&app, "agent-window")
    .title("Hive Agent")
    .inner_size(width, height)
    .build();
    match window {
        Ok(w) => {

            // Main Webview
            let webview_builder = tauri::webview::WebviewBuilder::new(
                "agent-webview1", 
                WebviewUrl::App("/webAgent".into()),)
                .initialization_script(preload_js)
                .auto_resize();
            
            // Agent Window
            let _webview1 = w.add_child(
                webview_builder,
                LogicalPosition::new(0., 0.),
                LogicalSize::new(width * 0.8, height),
                );
            match _webview1 {
                Ok(_) => {},
                Err(e) => {
                    let er = format!("Error (build_multi_view_window) : {}", e);
                    return Err(er);
                }
            }

            // Sidebar Webview (botzy agent)
            let _webview2 = w.add_child(
            tauri::webview::WebviewBuilder::new(
                "agent-webview2",
                WebviewUrl::App("/webAgent".into())
            )
            .auto_resize(),
            LogicalPosition::new(width * 0.8, 0.),
            LogicalSize::new(width * 0.2, height),
            );
            match _webview2 {
                Ok(_) => {},
                Err(e) => {
                    let er = format!("Error (build_multi_view_window) : {}", e);
                    return Err(er);
                }
            }
            return Ok(());
        },
        Err(e   ) => {
            let er = format!("Error (build_multi_view_window) : {}", e);
            return Err(er);
        }
    }
}

pub fn navigate_webview(handle: AppHandle, url: WebviewUrl, webview_label: &str) -> Result<(), String> {
    let window = handle.get_webview(webview_label)
    .ok_or("Window not found")?;

    match url {
        WebviewUrl::External(external_url) => {
            window.navigate(external_url).map_err(|e| e.to_string())?;
        }
        WebviewUrl::App(app_path) => {
            let protocol = if cfg!(windows) { "http" } else { "tauri" };
            let url_str = format!("{}://localhost/{}", protocol, app_path.display());
            let parsed_url = url_str.parse().map_err(|_| "Invalid URL".to_string())?;
            window.navigate(parsed_url).map_err(|e| e.to_string())?;
        }
        _ => {
            return Err("Unsupported URL variant".to_string());
        }
    }
    Ok(())
}

// Used to emit a message to a specific webview
pub fn emit_to_specific_webview(app: AppHandle, event: &str, payload: &str, webview_label: &str) -> Result<(), String> {
    app.emit_to(webview_label, event, payload).map_err(|e| e.to_string())
}

pub fn eval_in_specific_webview(app: AppHandle, js_code: &str, webview_label: &str) -> Result<(), String> {
    let webview = app.get_webview(webview_label).ok_or("Webview not found")?;
    webview.eval(js_code).map_err(|e| e.to_string())
}

// Show and centre a specific window
pub fn show_and_center_window(app: AppHandle, window_label: &str) -> Result<(), String> {
    let window = app.get_window(window_label);
    match window {
        Some(w) => {
            let is_visble = w.is_visible().unwrap_or(false);
            if is_visble {
                return Ok(());
            }
            let _ = w.show();
            let _ = w.center();
        }
        None => {
            return Err(format!("Window label '{}' not found", window_label));
        }
    }
    Ok(())       
}

// Checks if a window with the given label exists
pub fn check_window_exists(app: AppHandle, window_label: &str) -> bool {
    app.get_window(window_label).is_some()
}

// Triggers the agent webview to capture the DOM and send it back.
pub fn trigger_agent_dom_capture(app: AppHandle) -> Result<(), String> {
    let code = "document.dispatchEvent(new Event('__HIVE_CAPTURE_DOM__'));";
    eval_in_specific_webview(
        app, 
        code, 
        "agent-webview1"
    )
}

