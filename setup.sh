#!/bin/bash
echo "Setting up AI Agent Orchestration Platform..."
cd backend && pip install -r requirements.txt
cd ../frontend && npm install
echo "Setup complete. Run: ./start.sh"
