# syntax=docker/dockerfile:1

# Abhängigkeiten in einer eigenen Stufe: Sie ändern sich selten, die Schicht
# bleibt bei Codeänderungen also im Cache.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Läuft die Seite unter einem Unterpfad, muss das Präfix schon beim Bauen
# bekannt sein — nachträglich lässt es sich nicht mehr setzen.
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH

RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Wegpunkte in ein eigenes Verzeichnis, auf das ein Volume zeigt. Ohne das
# lägen sie im Container und wären nach jedem Neubau verschwunden.
ENV WAYPOINTS_FILE=/data/waypoints.json

COPY --from=build /app/.next ./.next
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./

# Beide Verzeichnisse müssen dem Dienstnutzer gehören: /data für die
# Wegpunkte, .next/cache für den zwischengespeicherten Wetterabruf.
RUN mkdir -p /data && chown -R node:node /data /app/.next

USER node
EXPOSE 3000
CMD ["npm", "start"]
