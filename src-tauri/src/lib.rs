use encoding_rs::{UTF_8, WINDOWS_1251};
use serde::Serialize;
use std::path::Path;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

const APP_USER_MODEL_ID: &str = "com.dates.reminder";

#[derive(Serialize)]
pub struct ReadTextResult {
    pub text: String,
    pub encoding: String,
}

#[cfg(windows)]
fn init_windows_identity() {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::SetCurrentProcessExplicitAppUserModelID;

    let wide: Vec<u16> = APP_USER_MODEL_ID
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();
    unsafe {
        let _ = SetCurrentProcessExplicitAppUserModelID(PCWSTR(wide.as_ptr()));
    }
}

/// Ярлык «DATES» в меню Пуск с System.AppUserModel.ID —
/// иначе Windows не знает display name для тостов и может показать Cursor.
#[cfg(windows)]
fn ensure_start_menu_shortcut(exe: &Path) {
    use windows::core::{Interface, HSTRING};
    use windows::Win32::Storage::EnhancedStorage::PKEY_AppUserModel_ID;
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED, IPersistFile, StructuredStorage::PROPVARIANT,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, PropertiesSystem::IPropertyStore, ShellLink};

    let Some(appdata) = std::env::var_os("APPDATA") else {
        return;
    };
    let lnk = Path::new(&appdata)
        .join("Microsoft")
        .join("Windows")
        .join("Start Menu")
        .join("Programs")
        .join("DATES.lnk");

    let work_dir = exe.parent().unwrap_or(Path::new("."));
    let _ = (|| -> windows::core::Result<()> {
        unsafe {
            CoInitializeEx(None, COINIT_APARTMENTTHREADED).ok()?;
        }
        let result = (|| -> windows::core::Result<()> {
            let link: IShellLinkW =
                unsafe { CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER)? };
            unsafe {
                link.SetPath(&HSTRING::from(exe.as_os_str()))?;
                link.SetWorkingDirectory(&HSTRING::from(work_dir.as_os_str()))?;
                link.SetDescription(&HSTRING::from("DATES"))?;
            }
            let store: IPropertyStore = link.cast()?;
            let value = PROPVARIANT::from(APP_USER_MODEL_ID);
            unsafe {
                store.SetValue(&PKEY_AppUserModel_ID as *const _, &value as *const _)?;
                store.Commit()?;
            }
            let persist: IPersistFile = link.cast()?;
            unsafe {
                persist.Save(&HSTRING::from(lnk.as_os_str()), true)?;
            }
            Ok(())
        })();
        unsafe {
            CoUninitialize();
        }
        result
    })();
}

#[tauri::command]
fn read_text_auto(path: String) -> Result<ReadTextResult, String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;

    let (cow, _, had_errors) = UTF_8.decode(&bytes);
    if !had_errors {
        return Ok(ReadTextResult {
            text: cow.into_owned(),
            encoding: "utf-8".into(),
        });
    }

    let (cow1251, _, _) = WINDOWS_1251.decode(&bytes);
    Ok(ReadTextResult {
        text: cow1251.into_owned(),
        encoding: "windows-1251".into(),
    })
}

#[tauri::command]
fn write_text_utf8(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}

#[tauri::command]
fn launched_via_autostart() -> bool {
    is_autostart_launch()
}

/// Тост с явным AppID DATES (в dev Tauri-плагин не ставит app_id → Windows пишет Cursor).
#[tauri::command]
fn show_app_notification(title: String, body: String) -> Result<(), String> {
    let mut n = notify_rust::Notification::new();
    n.summary(&title).body(&body);
    #[cfg(windows)]
    {
        n.app_id(APP_USER_MODEL_ID);
    }
    n.show().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn copy_to_photos(app: tauri::AppHandle, source: String, id: String) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("photos");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let ext = Path::new(&source)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("jpg");
    let safe_id: String = id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let dest = dir.join(format!("{}.{}", safe_id, ext));
    std::fs::copy(&source, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

/// Удаляет файл фото, если он лежит в app_data/photos.
#[tauri::command]
fn remove_photo_file(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let Ok(dir) = app.path().app_data_dir() else {
        return Ok(());
    };
    let photos = dir.join("photos");
    let target = Path::new(&path);
    let Ok(canon_photos) = photos.canonicalize() else {
        let _ = std::fs::remove_file(target);
        return Ok(());
    };
    let Ok(canon_target) = target.canonicalize() else {
        return Ok(());
    };
    if canon_target.starts_with(&canon_photos) {
        let _ = std::fs::remove_file(&canon_target);
    }
    Ok(())
}

/// Windows после hide() часто оставляет окно в (-32000,-32000).
/// Если позиция вне всех мониторов — центрируем.
fn ensure_window_on_screen(window: &tauri::WebviewWindow) {
    let Ok(pos) = window.outer_position() else {
        let _ = window.center();
        return;
    };
    let Ok(size) = window.outer_size() else {
        return;
    };
    let x = pos.x;
    let y = pos.y;
    let w = size.width as i32;
    let h = size.height as i32;

    // Классический «скрытый» якорь Windows / явно битые координаты
    if x <= -10_000 || y <= -10_000 || w <= 0 || h <= 0 {
        let _ = window.center();
        return;
    }

    let monitors = window.available_monitors().unwrap_or_default();
    if monitors.is_empty() {
        let _ = window.center();
        return;
    }

    let on_screen = monitors.iter().any(|m| {
        let mp = m.position();
        let ms = m.size();
        let left = mp.x;
        let top = mp.y;
        let right = left + ms.width as i32;
        let bottom = top + ms.height as i32;
        // Хотя бы ~80px окна должно быть видно
        x + w > left + 40 && x < right - 40 && y + h > top + 40 && y < bottom - 40
    });

    if !on_screen {
        let _ = window.center();
    }
}

#[cfg(windows)]
fn force_foreground(window: &tauri::WebviewWindow) {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::Threading::{AttachThreadInput, GetCurrentThreadId};
    use windows::Win32::UI::WindowsAndMessaging::{
        BringWindowToTop, GetForegroundWindow, GetWindowThreadProcessId, IsIconic,
        SetForegroundWindow, ShowWindow, SW_RESTORE, SW_SHOW,
    };

    let Ok(hwnd_raw) = window.hwnd() else {
        return;
    };
    let hwnd = HWND(hwnd_raw.0 as *mut std::ffi::c_void);

    unsafe {
        if IsIconic(hwnd).as_bool() {
            let _ = ShowWindow(hwnd, SW_RESTORE);
        } else {
            let _ = ShowWindow(hwnd, SW_SHOW);
        }

        let fg = GetForegroundWindow();
        let fg_tid = GetWindowThreadProcessId(fg, None);
        let cur_tid = GetCurrentThreadId();
        if fg_tid != 0 && fg_tid != cur_tid {
            let _ = AttachThreadInput(fg_tid, cur_tid, true);
            let _ = SetForegroundWindow(hwnd);
            let _ = BringWindowToTop(hwnd);
            let _ = AttachThreadInput(fg_tid, cur_tid, false);
        } else {
            let _ = SetForegroundWindow(hwnd);
            let _ = BringWindowToTop(hwnd);
        }
    }
}

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        ensure_window_on_screen(&window);
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        #[cfg(windows)]
        force_foreground(&window);

        let win = window.clone();
        let _ = app.run_on_main_thread(move || {
            ensure_window_on_screen(&win);
            let _ = win.unminimize();
            let _ = win.show();
            let _ = win.set_focus();
            #[cfg(windows)]
            force_foreground(&win);
        });
    }
}

fn is_autostart_launch() -> bool {
    std::env::args().any(|a| a == "--autostart")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(windows)]
    init_windows_identity();

    tauri::Builder::default()
        // Важно первым: второй запуск не создаёт процесс, а показывает текущее окно
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .invoke_handler(tauri::generate_handler![
            read_text_auto,
            write_text_utf8,
            copy_to_photos,
            remove_photo_file,
            launched_via_autostart,
            show_app_notification
        ])
        .setup(|app| {
            #[cfg(windows)]
            if let Ok(exe) = std::env::current_exe() {
                ensure_start_menu_shortcut(&exe);
            }

            // Обычный запуск (не автостарт) — всегда показать окно,
            // даже если раньше ушли в трей / skipTaskbar.
            if !is_autostart_launch() {
                show_main_window(app.handle());
            }

            let show_i = MenuItem::with_id(app, "show", "Открыть DATES", true, None::<&str>)?;
            let sync_i =
                MenuItem::with_id(app, "sync", "Обновить знаменательные дни", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Выход", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &sync_i, &quit_i])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("DATES")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "sync" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("dates://sync-holidays", ());
                            show_main_window(app);
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    }
                    | TrayIconEvent::DoubleClick {
                        button: MouseButton::Left,
                        ..
                    } => {
                        show_main_window(tray.app_handle());
                    }
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
