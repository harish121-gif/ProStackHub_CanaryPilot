from datetime import datetime
import os
import time

import mysql.connector
import psutil
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest

load_dotenv()

app = Flask(__name__)
CORS(app)

REQUEST_COUNTER = Counter(
    "canarypilot_http_requests_total",
    "Total HTTP requests handled by CanaryPilot",
    ["method", "endpoint", "status"],
)
CPU_GAUGE = Gauge("canarypilot_cpu_usage_percent", "Current CPU usage percentage")
MEMORY_GAUGE = Gauge("canarypilot_memory_usage_percent", "Current memory usage percentage")
APP_INFO_GAUGE = Gauge(
    "canarypilot_application_info",
    "Current CanaryPilot application info",
    ["application", "version"],
)


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "canarypilot"),
        connection_timeout=5,
    )


def fetch_one(query, params=()):
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params)
        return cursor.fetchone()
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def fetch_all(query, params=()):
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(query, params)
        return cursor.fetchall()
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


def json_safe(value):
    if isinstance(value, datetime):
        return value.isoformat()
    return value


@app.after_request
def count_request(response):
    endpoint = request.path
    REQUEST_COUNTER.labels(request.method, endpoint, response.status_code).inc()
    return response


@app.route("/", methods=["GET"])
def home():
    return jsonify({"message": "CanaryPilot API is running", "version": "1.0.0"})


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "healthy",
        "service": "CanaryPilot",
        "timestamp": datetime.utcnow().isoformat() + "Z",
    })


@app.route("/api/ready", methods=["GET"])
def ready():
    try:
        fetch_one("SELECT 1 AS ok")
        return jsonify({"status": "ready", "database": "connected"})
    except Exception as exc:
        return jsonify({"status": "not_ready", "message": str(exc)}), 503


@app.route("/api/db-test", methods=["GET"])
def db_test():
    try:
        row = fetch_one("SELECT DATABASE() AS database_name")
        return jsonify({"status": "connected", "database": row["database_name"]})
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


@app.route("/metrics", methods=["GET"])
def metrics():
    CPU_GAUGE.set(psutil.cpu_percent(interval=0.05))
    MEMORY_GAUGE.set(psutil.virtual_memory().percent)
    try:
        rows = fetch_all("SELECT name, current_version FROM applications")
        for row in rows:
            APP_INFO_GAUGE.labels(row["name"], row["current_version"] or "unknown").set(1)
    except Exception:
        pass
    return generate_latest(), 200, {"Content-Type": CONTENT_TYPE_LATEST}


@app.route("/api/applications", methods=["GET"])
def get_applications():
    try:
        rows = fetch_all(
            """
            SELECT id, name, description, repository,
                   current_version, stable_version, created_at
            FROM applications
            ORDER BY id DESC
            """
        )
        return jsonify({
            "status": "success",
            "count": len(rows),
            "applications": [
                {key: json_safe(value) for key, value in row.items()} for row in rows
            ],
        })
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


@app.route("/api/applications", methods=["POST"])
def create_application():
    payload = request.get_json(silent=True) or {}
    required = ["name", "description", "repository", "current_version", "stable_version"]
    missing = [field for field in required if not payload.get(field)]
    if missing:
        return jsonify({"status": "error", "message": f"Missing fields: {', '.join(missing)}"}), 400

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO applications
            (name, description, repository, current_version, stable_version)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (
                payload["name"],
                payload["description"],
                payload["repository"],
                payload["current_version"],
                payload["stable_version"],
            ),
        )
        connection.commit()
        application_id = cursor.lastrowid
        return jsonify({"status": "success", "message": "Application created", "id": application_id}), 201
    except Exception as exc:
        if connection:
            connection.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.route("/api/deployments", methods=["GET"])
def get_deployments():
    try:
        rows = fetch_all(
            """
            SELECT d.id, d.application_id, a.name AS application_name,
                   a.stable_version, d.version, d.canary_percentage,
                   d.status, d.started_at, d.completed_at
            FROM deployments d
            JOIN applications a ON d.application_id = a.id
            ORDER BY d.id DESC
            """
        )
        return jsonify({
            "status": "success",
            "count": len(rows),
            "deployments": [
                {key: json_safe(value) for key, value in row.items()} for row in rows
            ],
        })
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


@app.route("/api/deployments", methods=["POST"])
def create_deployment():
    payload = request.get_json(silent=True) or {}
    required = ["application_id", "version"]
    missing = [field for field in required if payload.get(field) in (None, "")]
    if missing:
        return jsonify({"status": "error", "message": f"Missing fields: {', '.join(missing)}"}), 400

    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT id FROM applications WHERE id = %s", (payload["application_id"],))
        if not cursor.fetchone():
            return jsonify({"status": "error", "message": "Application not found"}), 404
        cursor.execute(
            """
            INSERT INTO deployments(application_id, version, canary_percentage, status)
            VALUES (%s, %s, %s, 'RUNNING')
            """,
            (payload["application_id"], payload["version"], int(payload.get("canary_percentage", 10))),
        )
        deployment_id = cursor.lastrowid
        connection.commit()
        return jsonify({"status": "success", "message": "Deployment created", "id": deployment_id}), 201
    except Exception as exc:
        if connection:
            connection.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.route("/api/deployments/<int:deployment_id>/promote", methods=["POST"])
def promote_deployment(deployment_id):
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, application_id, version, canary_percentage, status FROM deployments WHERE id = %s",
            (deployment_id,),
        )
        deployment = cursor.fetchone()
        if not deployment:
            return jsonify({"status": "error", "message": "Deployment not found"}), 404

        current = int(deployment["canary_percentage"] or 0)
        new_percentage = min(current + 25, 100)
        new_status = "SUCCESS" if new_percentage == 100 else "RUNNING"
        cursor.execute(
            """
            UPDATE deployments
            SET canary_percentage = %s,
                status = %s,
                completed_at = CASE WHEN %s = 100 THEN NOW() ELSE completed_at END
            WHERE id = %s
            """,
            (new_percentage, new_status, new_percentage, deployment_id),
        )
        cursor.execute(
            """
            UPDATE applications
            SET current_version = %s
            WHERE id = %s
            """,
            (deployment["version"], deployment["application_id"]),
        )
        connection.commit()
        return jsonify({
            "status": "success",
            "message": "Canary deployment promoted successfully",
            "deployment_id": deployment_id,
            "version": deployment["version"],
            "previous_percentage": current,
            "canary_percentage": new_percentage,
            "deployment_status": new_status,
        })
    except Exception as exc:
        if connection:
            connection.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.route("/api/deployments/<int:deployment_id>/rollback", methods=["POST"])
def rollback_deployment(deployment_id):
    connection = None
    cursor = None
    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            "SELECT id, application_id, version, canary_percentage, status FROM deployments WHERE id = %s",
            (deployment_id,),
        )
        deployment = cursor.fetchone()
        if not deployment:
            return jsonify({"status": "error", "message": "Deployment not found"}), 404

        cursor.execute(
            "SELECT stable_version FROM applications WHERE id = %s",
            (deployment["application_id"],),
        )
        application = cursor.fetchone()
        stable_version = application["stable_version"] if application else None

        cursor.execute(
            """
            INSERT INTO rollback_history(deployment_id, previous_version, reason)
            VALUES (%s, %s, %s)
            """,
            (deployment_id, stable_version, "Manual rollback triggered from CanaryPilot"),
        )
        cursor.execute(
            """
            UPDATE deployments
            SET canary_percentage = 0, status = 'ROLLED_BACK', completed_at = NOW()
            WHERE id = %s
            """,
            (deployment_id,),
        )
        connection.commit()
        return jsonify({
            "status": "success",
            "message": "Deployment rolled back successfully",
            "deployment_id": deployment_id,
            "canary_version": deployment["version"],
            "restored_version": stable_version,
            "canary_percentage": 0,
            "deployment_status": "ROLLED_BACK",
        })
    except Exception as exc:
        if connection:
            connection.rollback()
        return jsonify({"status": "error", "message": str(exc)}), 500
    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.route("/api/applications/<int:application_id>/metrics", methods=["GET"])
def get_metrics(application_id):
    try:
        dynamic = {
            "cpu_usage": round(psutil.cpu_percent(interval=0.05), 2),
            "memory_usage": round(psutil.virtual_memory().percent, 2),
            "error_rate": 0.4,
            "response_time": 180.0,
            "recorded_at": datetime.utcnow().isoformat() + "Z",
        }
        rows = fetch_all(
            """
            SELECT id, application_id, cpu_usage, memory_usage, error_rate,
                   response_time, recorded_at
            FROM monitoring_metrics
            WHERE application_id = %s
            ORDER BY recorded_at DESC
            LIMIT 20
            """,
            (application_id,),
        )
        formatted = [{key: json_safe(value) for key, value in row.items()} for row in rows]
        return jsonify({"status": "success", "count": len(formatted), "current": dynamic, "metrics": formatted})
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


@app.route("/api/incidents", methods=["GET"])
def get_incidents():
    try:
        rows = fetch_all(
            """
            SELECT i.id, i.application_id, a.name AS application_name,
                   i.title, i.description, i.severity, i.status,
                   i.created_at, i.resolved_at
            FROM incidents i
            JOIN applications a ON i.application_id = a.id
            ORDER BY i.id DESC
            """
        )
        return jsonify({
            "status": "success",
            "count": len(rows),
            "incidents": [{key: json_safe(value) for key, value in row.items()} for row in rows],
        })
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


@app.route("/api/rollback-history", methods=["GET"])
def get_rollback_history():
    try:
        rows = fetch_all(
            """
            SELECT r.id, r.deployment_id, d.version AS deployment_version,
                   r.previous_version, r.reason, r.rolled_back_at
            FROM rollback_history r
            JOIN deployments d ON r.deployment_id = d.id
            ORDER BY r.id DESC
            """
        )
        return jsonify({
            "status": "success",
            "count": len(rows),
            "history": [{key: json_safe(value) for key, value in row.items()} for row in rows],
        })
    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
