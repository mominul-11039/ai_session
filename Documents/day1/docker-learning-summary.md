# Docker & Containerization — সম্পূর্ণ সারসংক্ষেপ

---

## ১. Docker কী ও কেন

**সমস্যা:** "আমার মেশিনে তো চলে!" — কোড এক জায়গায় ঠিক চলে, আরেক জায়গায় চলে না (different dependency version, missing library)।

**সমাধান:** Docker অ্যাপকে তার সব dependency সহ **container** এ প্যাক করে — যেখানেই চালাও, একইভাবে চলবে।

### মূল ৪টা concept
| Term | মানে |
|---|---|
| **Image** | Read-only blueprint (ক্লাসের মতো) |
| **Container** | Image থেকে তৈরি চলমান instance (object এর মতো) |
| **Dockerfile** | Image বানানোর নির্দেশনা লেখা টেক্সট ফাইল |
| **Docker Hub / Registry** | Image রাখার জায়গা (GitHub এর মতো, কিন্তু image এর জন্য) |

### VM বনাম Container
- **VM**: প্রতিটার জন্য আলাদা পুরো OS লাগে → ভারী, স্লো
- **Container**: host OS এর kernel শেয়ার করে → হালকা, দ্রুত (সেকেন্ডে চালু হয়)

---

## ২. Install ও প্রথম যাচাই

```bash
docker --version
docker run hello-world
```

`hello-world` চালিয়ে সফল মেসেজ দেখলে বুঝবে setup ঠিক আছে।

**Linux এ sudo ছাড়া চালাতে:**
```bash
sudo usermod -aG docker $(whoami)
```
এরপর **নতুন terminal/session** লাগবে (group permission মাঝপথে load হয় না)।

---

## ৩. Basic Commands

```bash
docker images          # সব image দেখা
docker ps               # চলমান container দেখা
docker ps -a             # সব container (বন্ধ সহ) দেখা
docker run -d -p 8080:80 --name my-nginx nginx   # container চালানো
docker exec -it my-nginx bash   # container এর ভেতরে ঢোকা
docker logs my-nginx     # logs দেখা
docker stop my-nginx     # বন্ধ করা
docker rm my-nginx       # মোছা
```

`-d` = detached (background), `-p host:container` = port mapping, `-it` = interactive terminal।

---

## ৪. Dockerfile লেখা (নিজের অ্যাপ containerize করা)

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .
EXPOSE 5000
CMD ["python", "app.py"]
```

- `FROM` — base image
- `WORKDIR` — container এর ভেতরে working directory
- `COPY` — লোকাল ফাইল container এ কপি
- `RUN` — build-time কমান্ড
- `EXPOSE` — কোন পোর্টে অ্যাপ চলছে তার ডকুমেন্টেশন
- `CMD` — container চালু হলে যা চলবে

**Build ও Run:**
```bash
docker build -t my-app .
docker run -d -p 5000:5000 my-app
```

**গুরুত্বপূর্ণ প্র্যাকটিস:** `requirements.txt` কপি করে `pip install` — এই ধাপগুলো `COPY app.py` এর **আগে** রাখা হয় layer caching এর সুবিধার জন্য (নিচে ৯ নং দ্রষ্টব্য)।

---

## ৫. Docker Compose — Multi-container app

**সমস্যা:** বাস্তব অ্যাপে একাধিক service লাগে (web + database + cache)। প্রতিটার জন্য আলাদা `docker run` লেখা অসুবিধাজনক।

**সমাধান:** `docker-compose.yml` এ সব service define করে একসাথে চালানো।

```yaml
services:
  web:
    build: .
    ports:
      - "5000:5000"
    depends_on:
      - redis
  redis:
    image: redis:7-alpine
```

```bash
docker compose up -d      # সব service একসাথে চালু (background এ)
docker compose down       # সব বন্ধ ও মুছে ফেলা
docker compose ps         # status দেখা
docker compose logs -f    # live log দেখা
```

**`up` vs `up -d`:** `-d` ছাড়া terminal আটকে থাকে log এর সাথে (Ctrl+C দিলে container ও বন্ধ)। `-d` দিলে background এ চলে, terminal ফ্রি থাকে।

**মূল সুবিধা:** একই network এ থাকা container রা একে অপরকে **service নাম দিয়েই** খুঁজে পায় (IP address লাগে না) — `host='redis'` লিখলেই চলে, কারণ Docker এর internal DNS নাম কে IP তে translate করে দেয়।

---

## ৬. Volumes — ডাটা Persist করা

**সমস্যা:** `docker compose down` করলে container মুছে যায়, সাথে ভেতরের সব ডাটাও (যেমন database এর তথ্য) হারিয়ে যায়।

**সমাধান — Named volume:**
```yaml
services:
  redis:
    image: redis:7-alpine
    volumes:
      - redis-data:/data
    command: redis-server --save 60 1

volumes:
  redis-data:
```

- Container এর `/data` ফোল্ডার `redis-data` নামের volume এর সাথে যুক্ত — container মুছলেও ডাটা volume এ থেকে যায়
- `docker volume ls` — সব volume দেখা
- `docker volume inspect <name>` — বিস্তারিত দেখা

**দুই ধরনের volume:**
- **Named volume** — Docker নিজে ম্যানেজ করে (database এর জন্য সাধারণ)
- **Bind mount** (`./data:/data`) — host এর নির্দিষ্ট path ব্যবহার (development এ code live-reload এর জন্য)

---

## ৭. Environment Variables & Secrets

**সমস্যা:** Password, API key কোডে সরাসরি লেখা অনিরাপদ ও অনমনীয়।

**সমাধান:**

```python
import os
redis_host = os.environ.get('REDIS_HOST', 'localhost')  # fallback সহ
```

`.env` ফাইল:
```
REDIS_HOST=redis
APP_NAME=My App
```

`.gitignore` এ `.env` যোগ করা **আবশ্যক** (secret কখনো Git এ commit হওয়া উচিত না)।

`docker-compose.yml` এ:
```yaml
services:
  web:
    env_file:
      - .env
```

**যাচাই:**
```bash
docker compose exec web env | grep APP_NAME
```

**কোড বদলালে rebuild লাগে** (শুধু restart না):
```bash
docker compose up -d --build
```

---

## ৮. Networking

- Compose automatically একটা network বানায় (যেমন `flask-app_default`)
- একই network এ থাকা container রা **নাম দিয়ে** একে অপরকে খুঁজে পায় (internal DNS এর মাধ্যমে)
- `ports:` mapping লাগে শুধু **host থেকে** container এ পৌঁছাতে চাইলে; একই network এর ভেতরের container রা `ports:` ছাড়াই একে অপরের সব port এ পৌঁছাতে পারে

```bash
docker network ls
docker network inspect flask-app_default
docker compose exec web python3 -c "import socket; print(socket.gethostbyname('redis'))"
```

---

## ৯. Multi-stage Builds

**সমস্যা:** Build tools (compiler ইত্যাদি) final image এ থেকেই যায়, image বড় ও কম নিরাপদ হয়।

**সমাধান:**
```dockerfile
# Stage 1: build
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2: final (ফ্রেশ, ছোট)
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
COPY app.py .
ENV PATH=/root/.local/bin:$PATH
CMD ["python", "app.py"]
```

শুধু প্রয়োজনীয় ফলাফল (`/root/.local`) দ্বিতীয় stage এ কপি হয়, বাকি build tools/cache বাদ পড়ে যায়।

---

## ১০. `.dockerignore`

`.gitignore` এর মতো — কোন ফাইল/ফোল্ডার image এ কপি হবে না তা বলে দেয়।

```
.git
.env
__pycache__
*.pyc
.vscode
```

**সুবিধা:** build দ্রুত হয়, image ছোট থাকে, secret file (`.env`) ভুলবশত image এ ঢুকে যায় না।

---

## ১১. Image Optimization

**ক) Layer Caching:** কম বদলানো ফাইল (dependency list) আগে কপি করো, বেশি বদলানো (code) পরে। Dependency না বদলালে সেই layer আবার build হয় না — build দ্রুত হয়।

**খ) Base image বাছাই:**
| Image | সাইজ | কখন |
|---|---|---|
| `python:3.12` | বড় (~1GB) | সব tools লাগলে |
| `python:3.12-slim` | মাঝারি (~150MB) | সাধারণ ব্যবহারের জন্য নিরাপদ choice |
| `python:3.12-alpine` | ছোট (~50MB) | সাইজ critical, dependency compatible হলে |

**গ) RUN command combine করা:**
```dockerfile
RUN apt-get update && \
    apt-get install -y curl && \
    rm -rf /var/lib/apt/lists/*
```
একই layer এ install+cleanup না করলে, cleanup করলেও image সাইজ কমে না (layer filesystem এর কারণে)।

---

## ১২. Health Checks

**সমস্যা:** `docker ps` এ `Up` দেখানো মানে process চলছে, কিন্তু app আসলে ঠিকমতো কাজ করছে কিনা তা বোঝায় না।

**Flask endpoint:**
```python
@app.route('/health')
def health():
    try:
        cache.ping()
        return {"status": "healthy"}, 200
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}, 503
```

**Dockerfile এ:**
```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')" || exit 1
```

**Compose এ dependency কে health অনুযায়ী গেট করা:**
```yaml
services:
  web:
    depends_on:
      redis:
        condition: service_healthy
  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 3
```

`docker compose ps` এ status `Up (healthy)` দেখাবে।

---

## ১৩. Custom Docker Networks

**সমস্যা:** সব container একই network এ থাকলে fine-grained isolation করা যায় না।

**সমাধান — একাধিক network দিয়ে isolate করা:**
```yaml
services:
  nginx:
    networks: [frontend]     # শুধু frontend
  web:
    networks: [frontend, backend]   # দুইটাতেই
  redis:
    networks: [backend]      # শুধু backend, nginx দেখতে পারবে না

networks:
  frontend:
  backend:
```

**দুইটা আলাদা Compose প্রজেক্ট কে সংযুক্ত করা (external network):**
```bash
docker network create shared-network
```
```yaml
networks:
  shared-network:
    external: true
    name: shared-network   # আসল network এর নাম
```

`external: true` মানে "নতুন network বানিও না, existing network ব্যবহার করো" — এটা শুধু নির্দিষ্ট নামের network এর সাথে যুক্ত করে, সব network access দেয় না।

---

## ১৪. GPU Access (Ollama / AI workload এর জন্য)

**ধাপসমূহ:**
```bash
# ১. Host এ driver যাচাই
nvidia-smi
nvidia-smi -L    # কতগুলো GPU ও তাদের ID

# ২. NVIDIA Container Toolkit install
sudo apt-get install -y nvidia-container-toolkit

# ৩. Docker কে configure করা
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# ৪. যাচাই
docker run --rm --gpus all nvidia/cuda:12.4.0-base-ubuntu22.04 nvidia-smi

# ৫. Ollama চালানো GPU সহ
docker run -d --gpus all -v ollama-data:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

**Compose এ GPU reservation:**
```yaml
services:
  ollama:
    image: ollama/ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all          # অথবা count: 1, অথবা device_ids: ["0"]
              capabilities: [gpu]
```

| Compose | `docker run` equivalent |
|---|---|
| `count: all` | `--gpus all` |
| `count: 1` | `--gpus 1` |
| `device_ids: ["0"]` | `--gpus '"device=0"'` |

**নোট:** `count` ও `device_ids` — যেকোনো একটাই ব্যবহার করা যায়, দুটো একসাথে না।

**গুরুত্বপূর্ণ:** Host এ সরাসরি install করা Ollama আর Docker container এর Ollama — সম্পূর্ণ আলাদা environment। Docker container এ চালালে আগের models আবার pull করতে হবে, অথবা host এর data folder bind-mount করতে হবে।

---

## দ্রুত রেফারেন্স — সবচেয়ে বেশি ব্যবহৃত কমান্ড

```bash
docker build -t <name> .                  # image build
docker run -d -p host:container --name X Y  # container চালানো
docker ps -a                              # সব container
docker images                             # সব image
docker exec -it <container> bash          # ভেতরে ঢোকা
docker logs <container>                   # log দেখা
docker compose up -d --build              # সব service চালু + rebuild
docker compose down                       # সব বন্ধ ও মুছে ফেলা
docker network ls / inspect               # network তথ্য
docker volume ls / inspect                # volume তথ্য
```

---

## এরপর যা শেখা যায় (আরও advanced)

- **Registry ও image publishing** — Docker Hub/private registry তে নিজের image push করা
- **Security best practices** — non-root user দিয়ে container চালানো, `docker scout` দিয়ে vulnerability scan
- **Container orchestration** — Kubernetes / Docker Swarm (একাধিক মেশিনে scale করতে)
