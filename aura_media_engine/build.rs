fn main() {
    println!("cargo:rerun-if-changed=src/core/process_core.cpp");
    println!("cargo:rerun-if-changed=src/core/bridge.h");

    // DIRECT HARDWARE LINKING: Phase 3
    let ffmpeg_dir = "C:\\ffmpeg";
    let include_path = format!("{}\\include", ffmpeg_dir);
    let lib_path = format!("{}\\lib", ffmpeg_dir);

    cc::Build::new()
        .cpp(true)
        .file("src/core/process_core.cpp")
        .include("src/core")
        .include(&include_path)
        .include("src/core") // Recursive include for the stub
        .compile("auracore");

    println!("cargo:rustc-link-search=native={}", lib_path);
    // Link the core FFmpeg libraries for Phase 3/4 muscle
    println!("cargo:rustc-link-lib=avcodec");
    println!("cargo:rustc-link-lib=avformat");
    println!("cargo:rustc-link-lib=avutil");
    println!("cargo:rustc-link-lib=swscale");
}
