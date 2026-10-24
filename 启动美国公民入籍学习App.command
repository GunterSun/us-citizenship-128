#!/usr/bin/env bash
# 美国公民入籍考试 128 题学习 APP 一键启动脚本
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR" || exit 1
python3 server.py
