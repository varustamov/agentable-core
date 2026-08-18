# Agentable? — Deploy на сервер (seo4agent.com / Beget VPS)

## Структура на сервере

```
/opt/agentable/
├── backend/        ← FastAPI
├── frontend/dist/  ← собранный React (статика)
└── agentable.db    ← SQLite база данных
```

---

## 1. Подготовка сервера

```bash
ssh root@YOUR_SERVER_IP

# Обновляем систему
apt update && apt upgrade -y

# Python, Node, Nginx
apt install -y python3 python3-venv nodejs npm nginx certbot python3-certbot-nginx

# Создаём директорию
mkdir -p /opt/agentable
```

---

## 2. Загрузка кода

С локального компа:
```bash
rsync -avz --exclude 'node_modules' --exclude '.venv' --exclude '__pycache__' \
  /Users/vladimirarustamov/Agents/AISEO/ root@YOUR_SERVER_IP:/opt/agentable/
```

---

## 3. Backend

```bash
cd /opt/agentable/backend

# Виртуальное окружение
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Конфиг
cp .env.example .env
nano .env
```

**Содержимое .env на сервере:**
```
JWT_SECRET_KEY=сгенерируй-длинную-случайную-строку-минимум-32-символа
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
DATABASE_URL=sqlite:////opt/agentable/agentable.db
CORS_ORIGINS=https://seo4agent.com
```

Сгенерировать секретный ключ:
```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Инициализация БД:
```bash
cd /opt/agentable/backend
.venv/bin/python -c "from app.db import init_db; init_db(); print('DB OK')"
```

---

## 4. Systemd сервис для бэкенда

```bash
nano /etc/systemd/system/agentable.service
```

```ini
[Unit]
Description=Agentable? Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/agentable/backend
ExecStart=/opt/agentable/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8002 --workers 2
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable agentable
systemctl start agentable
systemctl status agentable   # должен быть active (running)
```

---

## 5. Frontend (сборка)

На локальном компе:
```bash
cd /Users/vladimirarustamov/Agents/AISEO/frontend

# Поменяй в vite.config.ts — убери proxy, он нужен только для dev
# Для прода фронт обращается к /auth, /audit, /admin через Nginx

npm run build
```

Загрузи собранный dist на сервер:
```bash
rsync -avz /Users/vladimirarustamov/Agents/AISEO/frontend/dist/ \
  root@YOUR_SERVER_IP:/opt/agentable/frontend/dist/
```

---

## 6. Nginx конфиг

```bash
nano /etc/nginx/sites-available/agentable
```

```nginx
server {
    listen 80;
    server_name seo4agent.com www.seo4agent.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name seo4agent.com www.seo4agent.com;

    # SSL (certbot заполнит сам)
    ssl_certificate     /etc/letsencrypt/live/seo4agent.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/seo4agent.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Frontend (React SPA)
    root /opt/agentable/frontend/dist;
    index index.html;

    # Все API запросы → бэкенд
    location ~ ^/(auth|audit|admin|health|docs) {
        proxy_pass         http://127.0.0.1:8002;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # SSE — важно для стриминга аудита
        proxy_buffering    off;
        proxy_cache        off;
        proxy_read_timeout 120s;
        chunked_transfer_encoding on;
    }

    # React Router — все остальные пути → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
```

```bash
ln -s /etc/nginx/sites-available/agentable /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## 7. SSL сертификат (Let's Encrypt)

Сначала убедись что домен seo4agent.com указывает на IP сервера (DNS на Beget).

```bash
certbot --nginx -d seo4agent.com -d www.seo4agent.com
```

Авторенев работает автоматически через cron.

---

## 8. Первый админ

После деплоя зарегистрируйся на сайте, потом:

```bash
cd /opt/agentable/backend
.venv/bin/python make_admin.py your@email.com
```

Зайди на seo4agent.com/dashboard → увидишь кнопку "Admin panel" в сайдбаре.

---

## 9. Права доступа к файлам

```bash
chown -R www-data:www-data /opt/agentable
chmod 750 /opt/agentable
chmod 640 /opt/agentable/backend/.env
```

---

## 10. DNS на Beget

В панели Beget → Домены → seo4agent.com → DNS:
- A запись: `@` → IP сервера
- A запись: `www` → IP сервера

Подождать 1-24 часа на распространение DNS.

---

## Обновление кода (после изменений)

```bash
# Загрузить новый код
rsync -avz --exclude 'node_modules' --exclude '.venv' --exclude '__pycache__' \
  /Users/vladimirarustamov/Agents/AISEO/ root@YOUR_SERVER_IP:/opt/agentable/

# Пересобрать фронт и загрузить dist
cd /Users/vladimirarustamov/Agents/AISEO/frontend && npm run build
rsync -avz frontend/dist/ root@YOUR_SERVER_IP:/opt/agentable/frontend/dist/

# Рестартовать бэкенд
ssh root@YOUR_SERVER_IP "systemctl restart agentable"
```

---

## Мониторинг

```bash
# Логи бэкенда
journalctl -u agentable -f

# Статус
systemctl status agentable

# Nginx логи
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```
