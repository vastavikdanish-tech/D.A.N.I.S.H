FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt setup.py ./
RUN pip install --no-cache-dir -r requirements.txt fastapi uvicorn pyautogui pillow opencv-python pygetwindow psutil

COPY system-controller/ ./

EXPOSE 8766

CMD ["python", "main.py"]
