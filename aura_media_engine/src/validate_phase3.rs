fn main() -> Result<(), Box<dyn std::error::Error>> {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()?;

    runtime.block_on(async {
        println!("[AURA V-TEST] Initializing Global FFmpeg Core...");
        ffmpeg::init().expect("[FATAL] FFmpeg Init Failed");

        // BRIDGE: Phase 3 Hardware Initialization
        unsafe {
            aura_core_init();
        }

        let manager = Arc::new(IngestManager::new());
        let test_url = "http://devimages.apple.com/iphone/samples/bipbop/bipbopall.m3u8";
        
        println!("[AURA V-TEST] Spawning 1 Validation Ingest Task...");
        let manager_clone = Arc::clone(&manager);
        let url = test_url.to_string();
        
        manager_clone.register_stream(1, url.clone());
        run_ingest_session(1, url, manager_clone).expect("Validation Task Failed");

        println!("[AURA V-TEST] Validation Complete.");
    });

    Ok(())
}

// FFI
extern "C" {
    fn aura_core_init();
    fn aura_core_process_frame(data: *const u8, size: i32, width: i32, height: i32, pts: i64);
}
