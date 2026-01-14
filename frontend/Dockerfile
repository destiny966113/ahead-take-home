FROM node:20-alpine
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend /web
# Vite dev server
EXPOSE 5173
ENV HOST=0.0.0.0
CMD ["npm","run","dev","--","--host","0.0.0.0","--port","5173"]
