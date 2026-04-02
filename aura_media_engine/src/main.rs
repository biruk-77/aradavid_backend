mod manager;
mod task;

use ffmpeg_next as ffmpeg;
use image;
use std::sync::Arc;
use crate::manager::IngestManager;
use crate::task::run_ingest_session;
use axum::{routing::get, Router};
use bytes::Bytes;
use std::convert::Infallible;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .max_blocking_threads(1024)
        .build()?;

    runtime.block_on(async {
        println!("[AURA ENGINE] Initializing Global FFmpeg Core...");
        ffmpeg::init().expect("[FATAL] FFmpeg Init Failed");

        unsafe { aura_core_init(); }

        let manager = Arc::new(IngestManager::new());
        let manager_dashboard = Arc::clone(&manager);
        let manager_web = Arc::clone(&manager);
        let manager_web_status = Arc::clone(&manager);

        // WEB STREAMING SERVER: The Bridge between Silicon and Web
        tokio::spawn(async move {
            println!("\x1B[1;35m[AURA ENGINE] Initializing Web Bridge on 127.0.0.1:8081...\x1B[0m");
            let app = Router::new()
                .route("/mosaic", get(move || {
                    let m = Arc::clone(&manager_web);
                    async move {
                        let stream = async_stream::stream! {
                            let mut frame_timer = tokio::time::interval(std::time::Duration::from_millis(40)); // ~25 FPS for web
                            loop {
                                frame_timer.tick().await;
                                let (frame_data, total_streams) = {
                                    let canvas = m.canvas.read().unwrap();
                                    let streams = m.streams.lock().unwrap();
                                    (canvas.clone(), streams.len())
                                };
                                
                                if total_streams == 0 {
                                    // Yield a black frame if no streams
                                    let black_frame = vec![0; 1920 * 1080 * 3];
                                    if let Some(img) = image::RgbImage::from_raw(1920, 1080, black_frame) {
                                        let mut jpeg_data = Vec::new();
                                        let mut cursor = std::io::Cursor::new(&mut jpeg_data);
                                        if img.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(60)).is_ok() {
                                            yield Ok::<_, Infallible>(Bytes::from(encode_mjpeg_frame(jpeg_data)));
                                        }
                                    }
                                    continue;
                                }
                                
                                // Encode RGB24 to JPEG for Web Compatibility
                                let mut jpeg_data = Vec::new();
                                let mut cursor = std::io::Cursor::new(&mut jpeg_data);
                                if let Some(img) = image::RgbImage::from_raw(1920, 1080, frame_data) {
                                    if img.write_to(&mut cursor, image::ImageOutputFormat::Jpeg(70)).is_ok() {
                                        yield Ok::<_, Infallible>(Bytes::from(encode_mjpeg_frame(jpeg_data)));
                                    }
                                }
                            }
                        };
                        axum::response::Response::builder()
                            .header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
                            .header("Access-Control-Allow-Origin", "*")
                            .body(axum::body::Body::from_stream(stream))
                            .unwrap()
                    }
                }))
                .route("/status", get(move || {
                    let m = Arc::clone(&manager_web_status);
                    async move {
                        let (total, active, frames) = m.get_summary();
                        axum::Json(serde_json::json!({
                            "total_snipers": total,
                            "active_snipers": active,
                            "processed_frames": frames,
                            "engine_load": 1.5, // Placeholder for real CPU load
                        }))
                    }
                }));

            match tokio::net::TcpListener::bind("127.0.0.1:8081").await {
                Ok(listener) => {
                    println!("\x1B[1;32m[AURA ENGINE] [SUCCESS] Web Link Active on http://localhost:8081/mosaic\x1B[0m");
                    axum::serve(listener, app).await.unwrap();
                }
                Err(e) => {
                    println!("\x1B[1;31m[AURA ENGINE] [ERROR] Failed to bind Web Bridge to 8081: {}\x1B[0m", e);
                }
            }
        });

        // DASHBOARD TASK: Real-time Observability & FORENSIC LOGGER
        tokio::spawn(async move {
            let start = std::time::Instant::now();
            loop {
                // ANSI Clear screen and Cursor reset
                print!("\x1B[2J\x1B[H"); 
                println!("\x1B[1;36m   ___   _   _  ____    _       __  __ _____ ____ ___    _  \x1B[0m");
                println!("\x1B[1;36m  / _ \\ | | | ||  _ \\  / \\     |  \\/  | ____|  _ \\_ _|  / \\ \x1B[0m");
                println!("\x1B[1;36m / /_\\ \\| | | || |_) |/ _ \\    | |\\/| |  _| | | | | |  / _ \\ \x1B[0m");
                println!("\x1B[1;36m/ /___\\ \\ |_| ||  _ < / ___ \\   | |  | | |___| |_| | | / ___ \\\x1B[0m");
                println!("\x1B[1;36m/_/     \\_\\___/ |_| \\_/_/   \\_\\  |_|  |_|_____|____/___/_/   \\_\\\x1B[0m\n");

                {
                    let streams = manager_dashboard.streams.lock().unwrap();
                    let active = streams.len();
                    let mut total_frames = 0;
                    let mut total_bytes = 0;
                    
                    for (_, s) in streams.iter() {
                        total_frames += s.frame_count;
                        total_bytes += s.total_bytes;
                    }

                    println!("\x1B[1;33m[ FORENSIC LOGGER ] PHASE 10: THE GOD MOSAIC\x1B[0m");
                    println!("\x1B[1;37m--------------------------------------------------------------------------------\x1B[0m");
                    println!("IDENTIFIED SOCKETS : {:<4} | ACTIVE SNIPERS : {:<4}", 1, active);
                    println!("TOTAL FRAMES       : {:<4} | TOTAL MEMORY   : {:.2} MB", total_frames, total_bytes as f64 / 1_048_576.0);
                    println!("UPTIME             : {:<4} s", start.elapsed().as_secs());
                    println!("\x1B[1;37m--------------------------------------------------------------------------------\x1B[0m");
                    
                    if active > 0 {
                        println!("{:<6} | {:<12} | {:<10} | {:<40}", "ID", "STATUS", "FRAMES", "VIDEO SOURCE URL");
                        println!("\x1B[1;37m--------------------------------------------------------------------------------\x1B[0m");
                        
                        for (id, stream) in streams.iter() {
                            // Truncate URL so it fits beautifully
                            let url_trunc = if stream.url.len() > 37 { format!("{}...", &stream.url[0..37]) } else { stream.url.clone() };
                            
                            let st = if stream.is_active {
                                if stream.frame_count > 0 {
                                    "\x1B[1;32mPLAYING (VISIBLE)\x1B[0m"
                                } else {
                                    "\x1B[1;33mCONNECTING...\x1B[0m"
                                }
                            } else {
                                "\x1B[1;31mDROPPED/FINISHED\x1B[0m"
                            };
                            
                            println!("{:<6} | {:<17} | {:<10} | \x1B[1;34m{:<40}\x1B[0m", id, st, stream.frame_count, url_trunc);
                        }
                    }
                    
                    println!("\n\x1B[1;35m>>> MANUAL OVERRIDE COMMAND: ffplay -f rawvideo -pixel_format rgb24 -video_size 1920x1080 -framerate 30 -i pipeline.raw\x1B[0m");
                    println!("\x1B[1;35m>>> TO STREAM NATIVELY IN VLC: copy your URL into VLC Network Stream\x1B[0m");
                } // MutexGuard DROPS exactly here

                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
        });

        // REAL SILICON GOD RENDERING PIPELINE
        let canvas_ref = Arc::clone(&manager);
        std::thread::spawn(move || {
            let mut child = std::process::Command::new("ffplay")
                .args(&[
                    "-f", "rawvideo",
                    "-pixel_format", "rgb24",
                    "-video_size", "1920x1080",
                    "-framerate", "30",
                    "-probesize", "32",
                    "-analyzeduration", "0",
                    "-sync", "ext",
                    "-i", "-", 
                    "-window_title", "THE GOD MOSAIC - AURA CCTV",
                    "-x", "960", 
                    "-y", "540"
                ])
                .stdin(std::process::Stdio::piped()) 
                .spawn()
                .expect("CRITICAL: Failed to spawn ffplay for God Mosaic rendering!");

            let mut stdin = child.stdin.take().expect("Failed to grab ffplay stdin pipe!");
            use std::io::Write;
            
            loop {
                let frames = {
                    let canvas = canvas_ref.canvas.read().unwrap();
                    canvas.clone() 
                };
                
                if stdin.write_all(&frames).is_err() {
                    println!("\n\x1B[1;31m[AURA MOSAIC] CCTV Pipeline Severed (Window Closed).\x1B[0m");
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis(33));
            }
        });
        
        // MISSION CONTROL LOOP: Polling Command Plane
        let mut active_jobs = std::collections::HashSet::new();
        let client = reqwest::Client::new();
        loop {
            match client.get("http://localhost:8080/jobs").send().await {
                Ok(response) => {
                    match response.json::<Vec<IngestJob>>().await {
                        Ok(jobs) => {
                            for job in jobs {
                                if !active_jobs.contains(&job.id) {
                                    let stream_id = active_jobs.len() + 1;
                                    println!("[AURA ENGINE] [NEW MISSION] ID: {} | URL: {}", job.id, job.url);
                                    active_jobs.insert(job.id);
                                    
                                    let manager_clone = Arc::clone(&manager);
                                    let url = job.url.clone();
                                    let job_id = job.id;
                                    
                                    // [AUTO-ASSIGN] If this is the first job and layout is empty, map to Tile 0
                                    {
                                        let mut layout = manager_clone.layout.lock().unwrap();
                                        if layout.is_empty() {
                                            println!("[AURA ENGINE] [AUTO-MAP] Assigning first stream {} to Tile 0", job_id);
                                            layout.insert(job_id, 0);
                                        }
                                    }

                                    manager_clone.register_stream(stream_id, url.clone());

                                    tokio::task::spawn_blocking(move || {
                                        if let Err(e) = run_ingest_session(stream_id, job_id, url, manager_clone) {
                                            let err_msg = format!("\r\x1B[1;31m[CRITICAL ERROR] H.264 SNIPER THREAD CRASHED FOR ID {}: {:?}\x1B[0m\n", stream_id, e);
                                            println!("{}", err_msg);
                                            if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("engine_debug.log") {
                                                use std::io::Write;
                                                let _ = file.write_all(err_msg.as_bytes());
                                            }
                                        }
                                    });
                                }
                            }
                        }
                        Err(e) => {
                            println!("[AURA ENGINE] [ERROR] Failed to parse jobs JSON: {:?}", e);
                        }
                    }
                }
                Err(e) => {
                    println!("[AURA ENGINE] [ERROR] Failed to fetch jobs (Command Plane Offline?): {:?}", e);
                }
            }

            // [ROBUST] POLL LAYOUT: Fetch the latest matrix mapping
            match client.get("http://localhost:8080/layout").send().await {
                Ok(response) => {
                    match response.json::<std::collections::HashMap<uuid::Uuid, usize>>().await {
                        Ok(new_layout) => {
                            if !new_layout.is_empty() {
                                println!("[AURA ENGINE] [LAYOUT SYNC] Mission Map Updated: {:?}", new_layout);
                                manager.set_layout(new_layout);
                            }
                        }
                        Err(e) => {
                            // Possible deserialization failure if server returns non-JSON or wrong format
                            // println!("[AURA ENGINE] [DEBUG] Layout Sync skipped - waiting for valid map: {:?}", e);
                        }
                    }
                }
                Err(_) => {} 
            }

            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        }
    });

    Ok(())
}

fn encode_mjpeg_frame(jpeg_data: Vec<u8>) -> Vec<u8> {
    let header = format!(
        "--frame\r\nContent-Type: image/jpeg\r\nContent-Length: {}\r\n\r\n",
        jpeg_data.len()
    );
    let mut full_frame = Vec::from(header.as_bytes());
    full_frame.extend_from_slice(&jpeg_data);
    full_frame.extend_from_slice(b"\r\n");
    full_frame
}

#[derive(serde::Deserialize, Debug)]
struct IngestJob {
    id: uuid::Uuid,
    url: String,
    status: String,
}

// THE TRINITY BRIDGE: Phase 3 Native Hardware Link
extern "C" {
    fn aura_core_init();
}
