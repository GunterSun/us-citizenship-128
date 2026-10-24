#!/usr/bin/env python3
import http.server
import socketserver
import socket
import webbrowser
import os
import sys

PORT = 8128
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

def get_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class DualStackServer(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def log_message(self, format, *args):
        # Keep terminal output clean
        pass

if __name__ == "__main__":
    local_ip = get_ip()
    local_url = f"http://localhost:{PORT}"
    network_url = f"http://{local_ip}:{PORT}"

    print("=" * 66)
    print(" 🇺🇸 美国公民入籍考试 128 题全真复习指南 · 学习服务器已就绪")
    print("=" * 66)
    print(f" 💻 本机电脑打开网址:   {local_url}")
    print(f" 📱 手机/平板打开网址:  {network_url}")
    print("-" * 66)
    print(" 💡 使用指南:")
    print(" 1. 任何人的 iPhone、安卓手机、iPad 只要连接同一 Wi-Fi，")
    print(f"    在手机浏览器中输入: {network_url} 即可直接打开学习！")
    print(" 2. 在电脑页面右上角点击【手机扫码打开】，手机相机一扫即用！")
    print(" 3. 手机 Safari 中点击【分享】->【添加到主屏幕】，即成为独立手机 APP。")
    print("=" * 66)
    print(" 按 Ctrl + C 可随时退出服务器。\n")

    # Open local browser automatically
    try:
        webbrowser.open(local_url)
    except Exception:
        pass

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", PORT), DualStackServer) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n服务器已停止。祝您入籍考试顺利通关！")
            sys.exit(0)
