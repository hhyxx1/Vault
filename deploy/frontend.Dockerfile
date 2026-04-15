FROM docker.m.daocloud.io/library/node:20-alpine AS build
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend .
ARG VITE_API_BASE_URL=https://ai4teaching.cn/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM docker.m.daocloud.io/library/nginx:1.27-alpine
COPY deploy/frontend-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /frontend/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]