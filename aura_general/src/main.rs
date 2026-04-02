use axum::{
    extract::State,
    response::{IntoResponse, Json},
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct IngestJob {
    id: Uuid,
    url: String,
    status: String,
}

struct AppState {
    jobs: Mutex<Vec<IngestJob>>,
    layout: Mutex<std::collections::HashMap<Uuid, usize>>, // job_id -> tile_index (0-15)
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let state = Arc::new(AppState {
        jobs: Mutex::new(Vec::new()),
        layout: Mutex::new(std::collections::HashMap::new()),
    });

    let app = Router::new()
        .route("/", get(|| async { "AURA GENERAL - COMMAND PLANE ACTIVE" }))
        .route("/jobs", get(get_jobs))
        .route("/jobs", post(create_job))
        .route("/jobs/:id", post(update_job_status))
        .route("/scout/report", post(handle_scout_report)) // GATE 2: THE SOVEREIGN LINK
        .route("/layout", get(get_layout))
        .route("/layout", post(update_layout))
        .route("/drm/license", post(proxy_drm_license)) // GATE 3: THE SOVEREIGN WALL
        .route("/health", get(get_health))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    println!("[AURA GENERAL] Launching Command Plane on http://localhost:8080");
    axum::serve(listener, app).await.unwrap();
}

async fn get_jobs(
    axum::extract::State(state): axum::extract::State<Arc<AppState>>,
) -> Json<Vec<IngestJob>> {
    let jobs = state.jobs.lock().unwrap();
    Json(jobs.clone())
}

async fn create_job(
    ax_state: axum::extract::State<Arc<AppState>>,
    Json(payload): Json<IngestJobRequest>,
) -> Json<IngestJob> {
    let mut jobs = ax_state.jobs.lock().unwrap();
    let job = IngestJob {
        id: Uuid::new_v4(),
        url: payload.url,
        status: "QUEUED".to_string(),
    };
    jobs.push(job.clone());
    println!("[AURA GENERAL] [JOB REGISTERED] ID: {} | URL: {}", job.id, job.url);
    Json(job)
}

async fn update_job_status(
    ax_state: axum::extract::State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<Uuid>,
    Json(payload): Json<UpdateStatusRequest>,
) -> Json<bool> {
    let mut jobs = ax_state.jobs.lock().unwrap();
    if let Some(job) = jobs.iter_mut().find(|j| j.id == id) {
        println!("[AURA GENERAL] [STATUS SYNC] ID: {} -> {}", id, payload.status);
        job.status = payload.status;
        return Json(true);
    }
    println!("[AURA GENERAL] [ERROR] Job Not Found for Status Sync: {}", id);
    Json(false)
}

async fn get_layout(
    ax_state: axum::extract::State<Arc<AppState>>,
) -> Json<std::collections::HashMap<Uuid, usize>> {
    let layout = ax_state.layout.lock().unwrap();
    Json(layout.clone())
}

// THE COMMAND PLANE: Update the global matrix mapping
async fn update_layout(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<std::collections::HashMap<String, usize>>,
) -> impl IntoResponse {
    let mut new_layout = std::collections::HashMap::new();
    for (k, v) in payload {
        if let Ok(parsed_uuid) = Uuid::parse_str(&k) {
            new_layout.insert(parsed_uuid, v);
        }
    }
    
    let mut layout = state.layout.lock().unwrap();
    println!("[AURA GENERAL] [LAYOUT UPDATED] Mapping {} active tiles", new_layout.len());
    *layout = new_layout;
    Json(serde_json::json!({"status": "synchronized"}))
}

async fn get_health(
    ax_state: axum::extract::State<Arc<AppState>>,
) -> Json<serde_json::Value> {
    let jobs = ax_state.jobs.lock().unwrap();
    let total = jobs.len();
    let ingesting = jobs.iter().filter(|j| j.status == "INGESTING").count();
    Json(serde_json::json!({
        "status": "OPERATIONAL",
        "total_jobs": total,
        "active_jobs": ingesting,
        "version": "1.0.0-FORENSIC-MODE"
    }))
}

async fn handle_scout_report(
    ax_state: State<Arc<AppState>>,
    Json(payload): Json<ScoutReport>,
) -> Json<IngestJob> {
    let mut jobs = ax_state.jobs.lock().unwrap();
    let mut layout = ax_state.layout.lock().unwrap();
    
    // Create the Job
    let job = IngestJob {
        id: Uuid::new_v4(),
        url: payload.url,
        status: "QUEUED".to_string(),
    };
    jobs.push(job.clone());
    
    // Auto-Assign to next available tile if possible
    let current_tiles: Vec<usize> = layout.values().cloned().collect();
    for i in 0..16 {
        if !current_tiles.contains(&i) {
            println!("[AURA GENERAL] [GATE 2] Auto-Assigning Scout Report to Tile {}", i);
            layout.insert(job.id, i);
            break;
        }
    }

    println!("[AURA GENERAL] [SCOUT REPORT] Platform: {} | URL: {}", payload.platform, job.url);
    Json(job)
}

// ─── GATE 3: SOVEREIGN WALL LICENSE BRIDGE ───
async fn proxy_drm_license(
    Json(payload): Json<DrmLicenseRequest>,
) -> impl IntoResponse {
    println!("[AURA GENERAL] [DRM] Proxying License Request to: {}", payload.license_server_url);
    
    let client = reqwest::Client::new();
    let mut request = client.post(&payload.license_server_url).body(payload.challenge);

    // Map serializable HashMap to Reqwest HeaderMap
    if let Some(headers) = payload.headers {
        let mut header_map = reqwest::header::HeaderMap::new();
        for (k, v) in headers {
            if let (Ok(h_name), Ok(h_value)) = (reqwest::header::HeaderName::from_bytes(k.as_bytes()), reqwest::header::HeaderValue::from_str(&v)) {
                header_map.insert(h_name, h_value);
            }
        }
        request = request.headers(header_map);
    }

    let res = request.send().await;

    match res {
        Ok(response) => {
            let status = response.status();
            let body = response.bytes().await.unwrap_or_default();
            println!("[AURA GENERAL] [DRM] License Response: {}", status);
            (status, body).into_response()
        }
        Err(e) => {
            eprintln!("[AURA GENERAL] [DRM ERROR] Handshake failed: {}", e);
            (reqwest::StatusCode::BAD_GATEWAY, "DRM Bridge Timeout").into_response()
        }
    }
}

#[derive(Deserialize)]
struct DrmLicenseRequest {
    license_server_url: String,
    challenge: Vec<u8>, // Raw binary challenge from the bitstream handler
    headers: Option<std::collections::HashMap<String, String>>,
}

#[derive(Deserialize)]
struct ScoutReport {
    url: String,
    platform: String,
}

#[derive(Deserialize)]
struct IngestJobRequest {
    url: String,
}

#[derive(Deserialize)]
struct UpdateStatusRequest {
    status: String,
}
