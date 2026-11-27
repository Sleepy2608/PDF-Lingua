#!/usr/bin/env python3
"""
Script export Jira issues to CSV and generate sync report for PDF-Lingua.
"""

import os
import sys
import json
import base64
import urllib.request
import csv
from collections import Counter
from datetime import datetime

DEFAULT_EMAIL = "huytamnguyenle2608@gmail.com"
DEFAULT_TOKEN = os.environ.get("JIRA_API_TOKEN", "")
BASE_URL = "https://pdflingua.atlassian.net"

def fetch_all_issues(email, token, project_key="PDFL"):
    auth_str = f"{email}:{token}"
    auth_header = "Basic " + base64.b64encode(auth_str.encode()).decode()
    headers = {
        "Authorization": auth_header,
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    all_issues = []
    next_page_token = None

    print(f"Connecting to Jira ({BASE_URL}) for project '{project_key}'...")
    while True:
        body = {
            "jql": f"project = {project_key} ORDER BY key ASC",
            "maxResults": 100,
            "fields": [
                "summary", "status", "issuetype", "assignee", "reporter",
                "creator", "created", "updated", "resolution", "resolutiondate",
                "priority", "labels", "description", "parent",
                "customfield_10020", # Sprint
                "customfield_10016"  # Story point estimate
            ]
        }
        if next_page_token:
            body["nextPageToken"] = next_page_token

        req = urllib.request.Request(
            f"{BASE_URL}/rest/api/3/search/jql",
            data=json.dumps(body).encode(),
            headers=headers,
            method="POST"
        )

        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            issues = data.get("issues", [])
            all_issues.extend(issues)
            print(f"  -> Fetched {len(issues)} issues (total so far: {len(all_issues)})")
            if data.get("isLast") or not data.get("nextPageToken"):
                break
            next_page_token = data.get("nextPageToken")

    return all_issues

def parse_description(desc):
    if not desc:
        return ""
    if isinstance(desc, str):
        return desc
    if isinstance(desc, dict):
        # ADF (Atlassian Document Format)
        texts = []
        def extract_text(node):
            if isinstance(node, dict):
                if node.get("type") == "text":
                    texts.append(node.get("text", ""))
                for v in node.values():
                    extract_text(v)
            elif isinstance(node, list):
                for item in node:
                    extract_text(item)
        extract_text(desc)
        return " ".join(texts).strip()
    return str(desc)

def export_to_csv(issues, output_path):
    fieldnames = [
        "Issue Type",
        "Issue key",
        "Issue id",
        "Summary",
        "Status",
        "Priority",
        "Resolution",
        "Assignee",
        "Reporter",
        "Creator",
        "Created",
        "Updated",
        "Resolved",
        "Story Points",
        "Sprint",
        "Sprint State",
        "Parent Key",
        "Parent Summary",
        "Labels",
        "Description"
    ]

    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        for issue in issues:
            fields = issue.get("fields", {})

            # Sprint
            sprints = fields.get("customfield_10020") or []
            sprint_names = [s.get("name", "") for s in sprints if isinstance(s, dict)]
            sprint_states = [s.get("state", "") for s in sprints if isinstance(s, dict)]
            sprint_str = "; ".join(sprint_names)
            sprint_state_str = "; ".join(sprint_states)

            # Assignee
            assignee = fields.get("assignee")
            assignee_name = assignee.get("displayName") if assignee else "Unassigned"

            # Reporter / Creator
            reporter = fields.get("reporter")
            reporter_name = reporter.get("displayName") if reporter else ""
            creator = fields.get("creator")
            creator_name = creator.get("displayName") if creator else ""

            # Resolution
            res = fields.get("resolution")
            res_name = res.get("name") if res else ""

            # Parent / Epic
            parent = fields.get("parent")
            parent_key = parent.get("key", "") if parent else ""
            parent_summary = parent.get("fields", {}).get("summary", "") if parent else ""

            # Labels
            labels = ", ".join(fields.get("labels", []))

            # Description
            desc = parse_description(fields.get("description"))

            row = {
                "Issue Type": fields.get("issuetype", {}).get("name", ""),
                "Issue key": issue.get("key", ""),
                "Issue id": issue.get("id", ""),
                "Summary": fields.get("summary", ""),
                "Status": fields.get("status", {}).get("name", ""),
                "Priority": fields.get("priority", {}).get("name", ""),
                "Resolution": res_name,
                "Assignee": assignee_name,
                "Reporter": reporter_name,
                "Creator": creator_name,
                "Created": fields.get("created", ""),
                "Updated": fields.get("updated", ""),
                "Resolved": fields.get("resolutiondate", ""),
                "Story Points": fields.get("customfield_10016") or "",
                "Sprint": sprint_str,
                "Sprint State": sprint_state_str,
                "Parent Key": parent_key,
                "Parent Summary": parent_summary,
                "Labels": labels,
                "Description": desc
            }
            writer.writerow(row)

    print(f"Exported {len(issues)} issues to CSV: {output_path}")

def main():
    email = os.environ.get("JIRA_EMAIL", DEFAULT_EMAIL)
    token = os.environ.get("JIRA_API_TOKEN", DEFAULT_TOKEN)

    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, "PDFL_issues.csv")
    json_path = os.path.join(script_dir, "PDFL_issues.json")

    issues = fetch_all_issues(email, token, "PDFL")
    export_to_csv(issues, csv_path)

    # Save raw json for offline processing & updating markdown files
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(issues, f, ensure_ascii=False, indent=2)
    print(f"Saved raw JSON cache to: {json_path}")

if __name__ == "__main__":
    main()
