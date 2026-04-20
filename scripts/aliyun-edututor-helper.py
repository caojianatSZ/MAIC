#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
阿里云EduTutor - CutQuestions API调用辅助服务

由于直接HTTP调用认证复杂，这个脚本提供：
1. 使用阿里云SDK的正确认证方式
2. 或者作为中间层调用阿里云API
"""

import sys
import json
import subprocess

def main():
    # 解析命令行参数
    if len(sys.argv) < 2:
        error_result = {
            "error": "Missing parameters",
            "usage": "python aliyun-edututor-helper.py --image-url <url>"
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

    # 提取image-url参数
    image_url = None
    for i, arg in enumerate(sys.argv):
        if arg == '--image-url' and i + 1 < len(sys.argv):
            image_url = sys.argv[i + 1]
            break

    if not image_url:
        error_result = {
            "error": "Missing --image-url parameter"
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)

    # TODO: 实现阿里云API调用
    # 目前返回模拟数据用于测试
    result = {
        "questions": [
            {
                "pos_list": [[21, 0, 364, 0, 364, 82, 21, 82]],
                "sub_images": [],
                "merged_image": image_url,
                "info": {
                    "type": "选择题",
                    "stem": {
                        "text": "Python辅助服务正在测试中...",
                        "pos_list": [[21, 4, 364, 4, 364, 78, 21, 78]]
                    },
                    "option": [
                        {
                            "text": "A. 测试选项1",
                            "pos_list": [[21, 80, 100, 80, 100, 95, 21, 95]]
                        },
                        {
                            "text": "B. 测试选项2",
                            "pos_list": [[110, 80, 200, 80, 200, 95, 110, 95]]
                        }
                    ],
                    "figure": [],
                    "answer": []
                }
            }
        ]
    }

    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)

if __name__ == '__main__':
    main()
