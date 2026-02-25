# Elysia with Bun runtime

## Contributing
clone / fork this repo
```
git clone https://github.com/SilverWolfiee/SE-elysia1.git
```

## Getting Started
install dependencies
```bash
bun install
```

## Development
To start the development server run:
1. Create cafe.db
```bash
bunx drizzle-kit push 
```
2. run the server to seed the database(uncomment the seed function in src/index.ts)
```bash
bun run src/index.ts
```
3. re-comment the seed function and re-run
```bash
bun run src/index.ts
```
to start development

[API DOCS](https://www.notion.so/API-Docs-SE-Project-Group-1-3120967b2982805398c9d3c04d5bee0c?pvs=162&t=3120967b298280399c5700a9de96faf3)


## to do
1. Process food orders
2. :>>>
Open http://localhost:4000/ with your browser to see the result.