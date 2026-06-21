FROM swr.cn-north-4.myhuaweicloud.com/ddn-k8s/docker.io/library/node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm config set registry https://registry.npmmirror.com
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

RUN npm prune --production
RUN rm -rf src/ tsconfig.json

EXPOSE 3000

CMD ["node", "dist/index.js"]
