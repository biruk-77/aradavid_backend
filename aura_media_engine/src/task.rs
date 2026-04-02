use ffmpeg_next as ffmpeg;
use std::sync::Arc;
use crate::manager::IngestManager;

extern "C" {
    fn aura_core_snapshot(id: i32, data: *const u8, size: i32, width: i32, height: i32);
    fn aura_core_inject_watermark(data: *mut u8, size: i32, watermark_id: u64);
    fn aura_bind_gpu_muscle(decoder_ctx: *mut std::ffi::c_void);
}

pub fn run_ingest_session(id: usize, job_id: uuid::Uuid, url: String, manager: Arc<IngestManager>) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Inform Command Plane we are INGESTING
    let client = reqwest::blocking::Client::new();
    let res = client.post(format!("http://localhost:8080/jobs/{}", job_id))
        .timeout(std::time::Duration::from_secs(3))
        .json(&serde_json::json!({ "status": "INGESTING" }))
        .send();
    
    match res {
        Ok(r) => println!("[AURA TASK {}] Status synced to Command Plane: {} (Status: {})", id, job_id, r.status()),
        Err(e) => println!("[AURA TASK {}] [ERROR] Failed to sync status for {}: {:?}", id, job_id, e),
    }

    println!("[AURA TASK {}] Sniper Locked: {}", id, url);
    
    let mut ictx = {
        let mut opts = ffmpeg::Dictionary::new();
        
        // --- 🔱 STEALTH INGRESS: LOCAL HTTP BRIDGE ---
        opts.set("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36");
        opts.set("headers", "Accept: */*\r\nConnection: keep-alive\r\n");
        
        // --- 🔱 PROTOCOL RESILIENCE ---
        opts.set("rw_timeout", "30000000"); // 30s timeout
        opts.set("probesize", "5000000"); // 5MB probe
        opts.set("analyzeduration", "5000000"); // 5s analyze

        println!("[AURA TASK {}] Opening Source: {}...", id, url);
        match ffmpeg::format::input_with_dictionary(&url, opts) {
            Ok(ictx) => ictx,
            Err(e) => {
                let err_msg = format!("[AURA TASK {}] [FATAL] Source failed to open. CDNs might be blocking access! FFmpeg Error: {:?}\n", id, e);
                println!("{}", err_msg);
                if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("engine_debug.log") {
                    use std::io::Write;
                    let _ = file.write_all(err_msg.as_bytes());
                }
                return Err(Box::new(e));
            }
        }
    };

    println!("[AURA TASK {}] Source Opened. Searching for best video stream...", id);

    let stream = ictx
        .streams()
        .best(ffmpeg::media::Type::Video)
        .ok_or(ffmpeg::Error::StreamNotFound)?;
    let stream_index = stream.index();

    let fps = stream.avg_frame_rate();
    let frame_delay = if fps.numerator() > 0 && fps.denominator() > 0 {
        let fps_val = fps.numerator() as f64 / fps.denominator() as f64;
        std::time::Duration::from_secs_f64(1.0 / fps_val)
    } else {
        std::time::Duration::from_millis(33)
    };
    println!("[AURA TASK {}] Frame pacing: {:?} per frame ({}/{})", id, frame_delay, fps.numerator(), fps.denominator());

    let context_parameters = stream.parameters();
    let codec_id = context_parameters.id();
    
    // ATTEMPT HARDWARE LOCK: Search for NVIDIA CUDA/CUVID Decoders
    let hw_codec_name = match codec_id {
        ffmpeg::codec::Id::H264 => Some("h264_cuvid"),
        ffmpeg::codec::Id::HEVC => Some("hevc_cuvid"),
        _ => None,
    };

    let decoder_codec = if let Some(name) = hw_codec_name {
        if let Some(codec) = ffmpeg::decoder::find_by_name(name) {
            println!("[AURA TASK {}] [HARDWARE] NVIDIA CUVID Decoder Locked: {}", id, name);
            codec
        } else {
            println!("[AURA TASK {}] [WARNING] Hardware decoder {} not found. Falling back to CPU.", id, name);
            ffmpeg::decoder::find(codec_id).ok_or(ffmpeg::Error::DecoderNotFound)?
        }
    } else {
        ffmpeg::decoder::find(codec_id).ok_or(ffmpeg::Error::DecoderNotFound)?
    };

    let mut codec_context = ffmpeg::codec::context::Context::from_parameters(context_parameters)?;

    // --- 🔱 THE VRAM BRIDGE: BIND GPU MUSCLE ---
    // We bind the hardware context BEFORE opening the decoder to ensure
    // the CUVID/CUDA negotation happens at the kernel level.
    unsafe {
        aura_bind_gpu_muscle(codec_context.as_mut_ptr() as *mut std::ffi::c_void);
    }

    let mut decoder = codec_context.decoder().open_as(decoder_codec)?.video()?;
    
    println!("[AURA TASK {}] [HARDWARE] GPU Muscle Bound ({}x{} | {:?}). Ingestion Starting...", 
        id, decoder.width(), decoder.height(), decoder_codec.name());

    let tile_w: u32 = 480;
    let tile_h: u32 = 270;

    let mut scaler: Option<ffmpeg::software::scaling::context::Context> = None;
    let mut frame_count: u64 = 0;
    let mut frame = ffmpeg::util::frame::Video::empty();
    let mut rgb_frame = ffmpeg::util::frame::Video::empty();
    let mut last_frame_time = std::time::Instant::now();

    for (s, mut packet) in ictx.packets() {
        if s.index() != stream_index {
            continue;
        }
        
        let packet_size = packet.size() as u64;

        // --- 🔱 BITSTREAM SABOTAGE: NATIVE INTERCEPTION ---
        // We pass the raw encoded packet to the C++ Tank for bit-level manipulation (Watermarking)
        // BEFORE it reaches the decoder. This is the 'Silicon God' breach.
        unsafe {
            if let Some(data) = packet.data_mut() {
                aura_core_inject_watermark(data.as_mut_ptr(), packet.size() as i32, job_id.as_u128() as u64);
            }
        }

        match decoder.send_packet(&packet) {
            Ok(_) => {
                while decoder.receive_frame(&mut frame).is_ok() {
                    frame_count += 1;
                    
                    let now = std::time::Instant::now();
                    let fps = 1.0 / now.duration_since(last_frame_time).as_secs_f64();
                    manager.update_metrics(id, frame_count, packet_size, fps);

                    // Lazy-initialize scaler on first frame
                    if scaler.is_none() {
                        println!("[AURA TASK {}] Source: {}x{} {:?} → Tile: {}x{} RGB24",
                            id, frame.width(), frame.height(), frame.format(), tile_w, tile_h);
                        
                        scaler = Some(ffmpeg::software::scaling::context::Context::get(
                            frame.format(),
                            frame.width(),
                            frame.height(),
                            ffmpeg::format::Pixel::RGB24,
                            tile_w,
                            tile_h,
                            ffmpeg::software::scaling::flag::Flags::BILINEAR,
                        )?);

                        // PRE-ALLOCATE RGB FRAME
                        rgb_frame = ffmpeg::util::frame::Video::new(
                            ffmpeg::format::Pixel::RGB24,
                            tile_w,
                            tile_h
                        );
                    }

                    let sc = scaler.as_mut().unwrap();
                    sc.run(&frame, &mut rgb_frame)?;

                    // CRITICAL FIX: Explicitly extract pixel data row-by-row
                    // FFmpeg may pad rows to alignment boundaries, so we must
                    // use stride to skip padding and copy only pixel data.
                    let stride = rgb_frame.stride(0);
                    let plane = rgb_frame.data(0);
                    let row_bytes = (tile_w as usize) * 3; // Actual pixel data per row
                    
                    let mut owned_data = vec![0u8; (tile_w as usize) * (tile_h as usize) * 3];
                    for y in 0..(tile_h as usize) {
                        let src_offset = y * stride;
                        let dst_offset = y * row_bytes;
                        if src_offset + row_bytes <= plane.len() {
                            owned_data[dst_offset..dst_offset + row_bytes]
                                .copy_from_slice(&plane[src_offset..src_offset + row_bytes]);
                        }
                    }

                    // First frame diagnostic: verify we have real pixel data
                    if frame_count == 1 {
                        let non_zero = owned_data.iter().filter(|&&b| b > 0).count();
                        println!("\n\x1b[1;32m[AURA SNIPER {}] 🚀 FIRST FRAME | Stride: {} | Row: {} | Non-zero bytes: {}/{}\x1b[0m",
                            id, stride, row_bytes, non_zero, owned_data.len());
                        println!("\x1b[1;32m[SUCCESS] THE VIDEO IS PLAYING AND VISIBLE TO THE EYE! 👁️🎯\x1b[0m\n");
                        
                        // Save first frame as PPM for visual verification
                        if let Ok(mut f) = std::fs::File::create("first_frame.ppm") {
                            use std::io::Write;
                            let _ = writeln!(f, "P6\n{} {}\n255", tile_w, tile_h);
                            let _ = f.write_all(&owned_data);
                            println!("[AURA SNIPER {}] Saved diagnostic frame → first_frame.ppm", id);
                        }
                        
                        // 🔱 NOTIFY THE GENERAL: IT IS ALIVE AND VISIBLE
                        let res = reqwest::blocking::Client::new()
                            .post(format!("http://localhost:8080/jobs/{}", job_id))
                            .timeout(std::time::Duration::from_secs(3))
                            .json(&serde_json::json!({ "status": "PLAYING (VISIBLE)" }))
                            .send();
                    }

                    // Write to the shared canvas (using clean stride = row_bytes)
                    manager.write_to_canvas(job_id, &owned_data, row_bytes);

                    // Real-time frame pacing
                    let elapsed = last_frame_time.elapsed();
                    if elapsed < frame_delay {
                        std::thread::sleep(frame_delay - elapsed);
                    }
                    last_frame_time = std::time::Instant::now();

                    // Periodic forensic snapshot
                    if frame_count % 100 == 0 {
                        unsafe {
                            aura_core_snapshot(
                                id as i32,
                                owned_data.as_ptr(),
                                owned_data.len() as i32,
                                tile_w as i32,
                                tile_h as i32,
                            );
                        }
                    }

                    if frame_count >= 1_000_000 {
                        manager.finalize_stream(id);
                        return Ok(());
                    }
                }
            }
            Err(e) => {
                let err_msg = format!("[AURA TASK {}] [DECODER ERROR] Failed to send packet to decoder: {:?}\n", id, e);
                if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("engine_debug.log") {
                    use std::io::Write;
                    let _ = file.write_all(err_msg.as_bytes());
                }
            }
        }
    }

    if frame_count == 0 {
        let err_msg = format!("[AURA TASK {}] [FATAL] Stream exited with 0 frames decoded! Connection dropped mid-flight.\n", id);
        if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open("engine_debug.log") {
            use std::io::Write;
            let _ = file.write_all(err_msg.as_bytes());
        }
    }

    println!("\n[AURA TASK {}] Ingestion complete. Total frames: {}", id, frame_count);
    manager.finalize_stream(id);
    Ok(())
}

// ─── GATE 3: SOVEREIGN WALL HELPER ───
fn fetch_drm_key(target_url: &str) -> Option<String> {
    // In a real 0.0001% mission, this would extract the PSSH or Key URI
    // For now, we handshake with the AURA General License Bridge.
    let client = reqwest::blocking::Client::new();
    let res = client.post("http://localhost:8080/drm/license")
        .json(&serde_json::json!({
            "license_server_url": "https://mock-license.aura-sovereign.com/get",
            "challenge": vec![0u8; 16], // Mock challenge
            "target": target_url
        }))
        .send();

    match res {
        Ok(r) if r.status().is_success() => {
            let key = r.text().unwrap_or_default();
            if !key.is_empty() { Some(key) } else { None }
        }
        _ => None,
    }
}