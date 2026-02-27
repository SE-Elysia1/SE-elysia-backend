FROM oven/bun:latest

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .

RUN touch cafe.db

EXPOSE 4000

CMD ["bun", "run", "src/index.ts"]
