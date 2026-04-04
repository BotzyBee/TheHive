use tauri::{LogicalPosition, LogicalSize, WebviewUrl, AppHandle, Manager, Emitter};

pub async fn build_multi_view_window(app: tauri::AppHandle) -> tauri::Result<()> {
    let width = 1200.;
    let height = 700.;

    // let preload_js = r#"
    //     (function() {
    //         window.__TAURI__.event.listen('request-dom-capture', (event) => {
    //             const html = document.documentElement.outerHTML;
    //             console.log("Emitting DOM capture response with HTML length:", html.length);
    //             window.__TAURI__.event.emit('dom-response', {
    //                 label: window.__TAURI_INTERNALS__.metadata.label,
    //                 html: html
    //             });
    //         });
    //     })();
    // "#;

let preload_js = r#"
    console.log("Preload script executed, setting up event listener for 'request-dom-capture'...");
    window.__TAURI__.webview.getCurrentWebview().listen('request-dom-capture', (event) => {
        const html = document.documentElement.outerHTML;
        console.log("Emitting DOM capture response with HTML length:", html.length);
        const invoke = window.__TAURI__.core.invoke;
        
        // Added the missing comma after the command name
        invoke('print_agent_response', { payload: 'Hello from Javascript!' });
    }); 
"#;

    let window = tauri::window::WindowBuilder::new(&app, "agent-window")
    .title("Hive Agent")
    .inner_size(width, height)
    .build()?;

    // Main Webview
    let webview_builder = tauri::webview::WebviewBuilder::new(
        "agent-webview1", 
        WebviewUrl::App("/webAgent".into()),)
        .initialization_script(preload_js)
        .auto_resize();
    let _webview1 = window.add_child(
    webview_builder,
    LogicalPosition::new(0., 0.),
    LogicalSize::new(width * 0.8, height),
    )?;

    // Sidebar Webview (botzy agent)
    let _webview2 = window.add_child(
    tauri::webview::WebviewBuilder::new(
        "agent-webview2",
        WebviewUrl::App("/webAgent".into())
    )
    .auto_resize(),
    LogicalPosition::new(width * 0.8, 0.),
    LogicalSize::new(width * 0.2, height),
    )?;

    Ok(())
}

pub async fn navigate_webview(handle: AppHandle, url: WebviewUrl, webview_label: &str) -> Result<(), String> {
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





// pub async fn open_agent_window_impl(handle: AppHandle, target_url: String) {
//     let label = "agent-container";

//     if let Some(existing_win) = handle.get_webview_window(label) {
//         existing_win.set_focus().expect("failed to focus");

//         // We use .parse() directly. 
//         // Note: For local routes like "webAgent", navigate() requires the full tauri URL.
//         let nav_url = if target_url.starts_with("http") {
//             target_url.parse::<tauri::Url>().ok()
//         } else {
//             // Construct the internal URI for local routes
//             // Tauri v2 uses 'tauri://localhost' on macOS/Linux and 'http://localhost' on Windows
//             let protocol = if cfg!(windows) { "http" } else { "tauri" };
//             format!("{}://localhost/{}", protocol, target_url).parse::<tauri::Url>().ok()
//         };

//         if let Some(url) = nav_url {
//             let _ = existing_win.navigate(url);
//         }
//     } else {
//         // clone target_url here because .into() consumes it
//         let url_variant = if target_url.starts_with("http") {
//             tauri::WebviewUrl::External(target_url.parse().expect("Invalid URL"))
//         } else {
//             tauri::WebviewUrl::App(target_url.clone().into()) 
//         };

//         tauri::WebviewWindowBuilder::new(&handle, label, url_variant)
//             .title("The Hive Agent")
//             .inner_size(1200.0, 800.0)
//             .build()
//             .expect("failed to build window");
//     }
// }


// pub async fn get_page_source_impl(handle: AppHandle) -> Result<String, String> {
//     // Grab the window
//     let window = handle.get_webview_window("agent-container")
//         .ok_or("Browser window not found")?;

//     println!("Got window reference, preparing to retrieve page source...");
//     // Setup a one-shot channel to wait for the result
//     let (tx, rx) = oneshot::channel();
//     let tx = Arc::new(std::sync::Mutex::new( Some(tx) ));

//     // Listen for a one-time event from the frontend
//     let handler_id = handle.listen("source_response", move |event| {
//         if let Ok(mut tx_guard) = tx.lock() {
//             if let Some(sender) = tx_guard.take() {
//                 let _ = sender.send(event.payload().to_string());
//             }
//         }
//     });

//     println!("Listener set up, injecting JavaScript to get page source...");
//     // Inject JavaScript to extract the HTML and emit it back
//     window.eval("
//         (function() {
//             const html = document.documentElement.outerHTML;
//             window.__TAURI__.event.emit('source_response', html);
//         })();
//     ").map_err(|e| e.to_string())?;

//     // 5. Wait for the response (with a timeout is usually safer)
//     let result = rx.await.map_err(|_| "Failed to receive page source from webview")?;
//     println!("Received page source, length: {}", result.len());
//     // Cleanup the listener
//     handle.unlisten(handler_id);

//     Ok(result)
// }

// pub async fn navigate_and_return_source_impl(handle: AppHandle, url: String) -> Result<String, String> {
//     let window = handle.get_webview_window("agent-container")
//         .ok_or("Window not found")?;
//     let target_url = url.parse().map_err(|_| "Invalid URL")?;
//     println!("Navigating to URL: {}", target_url);
//     window.navigate(target_url).map_err(|e| e.to_string())?;
//     tokio::time::sleep(std::time::Duration::from_secs(5)).await; 
//     println!("Attempting to retrieve page source after navigation...");
//     get_page_source_impl(handle).await
// }


