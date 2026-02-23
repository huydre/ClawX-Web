#!/bin/bash

# ClawX Web Management Script

case "$1" in
  start)
    echo "🚀 Starting ClawX..."
    pm2 start ecosystem.config.js
    pm2 status
    ;;
  stop)
    echo "🛑 Stopping ClawX..."
    pm2 stop clawx-web
    ;;
  restart)
    echo "♻️  Restarting ClawX..."
    pm2 restart clawx-web
    pm2 status
    ;;
  status)
    pm2 status
    ;;
  logs)
    pm2 logs clawx-web
    ;;
  monitor)
    pm2 monit
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|logs|monitor}"
    exit 1
    ;;
esac
