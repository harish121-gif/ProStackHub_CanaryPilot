import json
import unittest
from unittest.mock import MagicMock, patch

from app import app


class CanaryPilotApiTestCase(unittest.TestCase):
    def setUp(self):
        app.config["TESTING"] = True
        self.client = app.test_client()

    def test_home(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["message"], "CanaryPilot API is running")
        self.assertEqual(data["version"], "1.0.0")

    def test_health(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["service"], "CanaryPilot")

    @patch("app.fetch_one")
    def test_ready_success(self, mock_fetch_one):
        mock_fetch_one.return_value = {"ok": 1}
        response = self.client.get("/api/ready")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["status"], "ready")

    @patch("app.fetch_one")
    def test_ready_failure(self, mock_fetch_one):
        mock_fetch_one.side_effect = Exception("DB Connection Refused")
        response = self.client.get("/api/ready")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.get_json()["status"], "not_ready")

    @patch("app.fetch_one")
    def test_db_test_success(self, mock_fetch_one):
        mock_fetch_one.return_value = {"database_name": "canarypilot"}
        response = self.client.get("/api/db-test")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["database"], "canarypilot")

    @patch("app.fetch_all")
    def test_metrics(self, mock_fetch_all):
        mock_fetch_all.return_value = [{"name": "payment-service", "current_version": "v1.2.0"}]
        response = self.client.get("/metrics")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"canarypilot_http_requests_total", response.data)

    @patch("app.fetch_all")
    def test_get_applications(self, mock_fetch_all):
        mock_fetch_all.return_value = [
            {
                "id": 1,
                "name": "payment-service",
                "description": "Payment gateway",
                "repository": "github.com/org/payment",
                "current_version": "v1.2.0",
                "stable_version": "v1.0.0",
                "created_at": None,
            }
        ]
        response = self.client.get("/api/applications")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["applications"][0]["name"], "payment-service")

    @patch("app.get_db_connection")
    def test_create_application_success(self, mock_get_db):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.lastrowid = 1
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_conn

        payload = {
            "name": "auth-service",
            "description": "User authentication",
            "repository": "github.com/org/auth",
            "current_version": "v1.0.0",
            "stable_version": "v1.0.0",
        }
        response = self.client.post(
            "/api/applications",
            data=json.dumps(payload),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["id"], 1)

    def test_create_application_missing_fields(self):
        response = self.client.post(
            "/api/applications",
            data=json.dumps({"name": "auth-service"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("Missing fields", response.get_json()["message"])

    @patch("app.fetch_all")
    def test_get_deployments(self, mock_fetch_all):
        mock_fetch_all.return_value = [
            {
                "id": 1,
                "application_id": 1,
                "application_name": "payment-service",
                "stable_version": "v1.0.0",
                "version": "v1.2.0",
                "canary_percentage": 25,
                "status": "RUNNING",
                "started_at": None,
                "completed_at": None,
            }
        ]
        response = self.client.get("/api/deployments")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(len(data["deployments"]), 1)

    @patch("app.get_db_connection")
    def test_promote_deployment_success(self, mock_get_db):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.return_value = {
            "id": 1,
            "application_id": 1,
            "version": "v1.2.0",
            "canary_percentage": 25,
            "status": "RUNNING",
        }
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_conn

        response = self.client.post("/api/deployments/1/promote")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["canary_percentage"], 50)

    @patch("app.get_db_connection")
    def test_rollback_deployment_success(self, mock_get_db):
        mock_conn = MagicMock()
        mock_cursor = MagicMock()
        mock_cursor.fetchone.side_effect = [
            {
                "id": 1,
                "application_id": 1,
                "version": "v1.2.0",
                "canary_percentage": 50,
                "status": "RUNNING",
            },
            {"stable_version": "v1.0.0"},
        ]
        mock_conn.cursor.return_value = mock_cursor
        mock_get_db.return_value = mock_conn

        response = self.client.post("/api/deployments/1/rollback")
        self.assertEqual(response.status_code, 200)
        data = response.get_json()
        self.assertEqual(data["status"], "success")
        self.assertEqual(data["deployment_status"], "ROLLED_BACK")


if __name__ == "__main__":
    unittest.main()
