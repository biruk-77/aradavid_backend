use std::sync::{Arc, Mutex, RwLock};
use std::collections::HashMap;

#[allow(dead_code)]
pub struct StreamStatus {
    pub url: String,
    pub frame_count: u64,
    pub total_bytes: u64,
    pub start_time: std::time::Instant,
    pub is_active: bool,
    pub fps: f64,
}

pub struct IngestManager {
    pub streams: Arc<Mutex<HashMap<usize, StreamStatus>>>,
    pub canvas: Arc<RwLock<Vec<u8>>>,
    pub layout: Arc<Mutex<HashMap<uuid::Uuid, usize>>>, // job_id -> tile_index (0-15)
}

impl IngestManager {
    pub fn new() -> Self {
        Self {
            streams: Arc::new(Mutex::new(HashMap::new())),
            canvas: Arc::new(RwLock::new(vec![0; 1920 * 1080 * 3])),
            layout: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /* ─── HUD OVERLAY DRAWER ─── */
    fn draw_hud(canvas: &mut [u8], col: usize, row: usize, status: &str) {
        let start_x = col * 480;
        let start_y = row * 270;
        let dest_stride = 1920 * 3;

        // Draw a small ID badge at the top-left of the tile (10, 10 offset)
        // Badge size: 40x10
        let badge_h = 12;
        let badge_w = 40;
        
        // Neon Cyan for active, Orange for queued
        let color = if status == "INGESTING" { [0, 240, 255] } else { [245, 158, 11] };
        
        for y in 0..badge_h {
            for x in 0..badge_w {
                let dx = start_x + x + 10;
                let dy = start_y + y + 10;
                let pos = dy * dest_stride + dx * 3;
                if pos + 2 < canvas.len() {
                    canvas[pos] = color[0];
                    canvas[pos+1] = color[1];
                    canvas[pos+2] = color[2];
                }
            }
        }
    }

    pub fn write_to_canvas(&self, job_id: uuid::Uuid, rgb_data: &[u8], src_stride: usize) {
        let idx = {
            let layout = self.layout.lock().unwrap();
            *layout.get(&job_id).unwrap_or(&99)
        };
        
        if idx >= 16 {
            return;
        }

        let col = idx % 4;
        let row = idx / 4;
        let start_x = col * 480;
        let start_y = row * 270;
        
        let mut canvas = self.canvas.write().unwrap();
        let dest_stride = 1920 * 3;
        
        for y in 0..270 {
            let src_start = y * src_stride;
            let src_end = src_start + 480 * 3;
            let dest_y = start_y + y;
            let dest_start = dest_y * dest_stride + start_x * 3;
            
            if dest_start + 480 * 3 <= canvas.len() && src_end <= rgb_data.len() {
                canvas[dest_start..dest_start + 480 * 3].copy_from_slice(&rgb_data[src_start..src_end]);
            }
        }

        // Draw Forensic Overlays
        Self::draw_hud(&mut canvas, col, row, "INGESTING");
    }


    pub fn register_stream(&self, id: usize, url: String) {
        let mut streams = self.streams.lock().unwrap();
        streams.insert(id, StreamStatus {
            url,
            frame_count: 0,
            total_bytes: 0,
            start_time: std::time::Instant::now(),
            is_active: true,
            fps: 0.0,
        });
    }

    pub fn update_metrics(&self, id: usize, frame_count: u64, bytes: u64, fps: f64) {
        let mut streams = self.streams.lock().unwrap();
        if let Some(status) = streams.get_mut(&id) {
            status.frame_count = frame_count;
            status.total_bytes += bytes;
            status.fps = fps;
        }
    }

    pub fn finalize_stream(&self, id: usize) {
        let mut streams = self.streams.lock().unwrap();
        if let Some(status) = streams.get_mut(&id) {
            status.is_active = false;
        }
    }

    pub fn set_layout(&self, new_layout: HashMap<uuid::Uuid, usize>) {
        let mut layout = self.layout.lock().unwrap();
        *layout = new_layout;
    }

    pub fn get_summary(&self) -> (usize, usize, u64) {
        let streams = self.streams.lock().unwrap();
        let total = streams.len();
        let active = streams.values().filter(|s| s.is_active).count();
        let frames = streams.values().map(|s| s.frame_count).sum();
        (total, active, frames)
    }
}
