FROM node:26
LABEL maintainer="IETF Tools Team <tools-discuss@ietf.org>"

ENV NODE_ENV=production

RUN mkdir -p /app && \
    chown node:node /app
WORKDIR /app

COPY .npmrc .npmrc
COPY index.js index.js
COPY meeting.json meeting.json
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY vite.config.js vite.config.js
COPY dist dist

RUN npm ci --omit=dev

USER node:node
EXPOSE 3000
CMD ["node", "index.js"]