
# Ruang Tugas

```
This project was created for the JURU full-stack technical test.
```

A single-page task management application built with PostgreSQL, Express, React, and Node.js. Tasks are stored in PostgreSQL and can be searched, filtered by status, and viewed 10 at a time.

## Run with Docker

Prerequisites: Docker Engine and Docker Compose. From the project root, create your environment file:

```bash
cp .env.example .env
```

Change `POSTGRES_PASSWORD` in `.env` before starting the application. Use URL-safe characters (`A-Z`, `a-z`, `0-9`, `-`, `_`, `.`, `~`) because Compose includes the password in the backend's `DATABASE_URL`.

```bash
docker compose up --build
```

If your Docker installation does not have the `buildx` plugin, use `DOCKER_BUILDKIT=0 docker compose up --build` instead.

Open [http://localhost:8080](http://localhost:8080). The frontend proxies `/api` and `/docs` requests to the backend over the Compose network; the database port is not exposed to the host. To stop the application:

```bash
docker compose down
```

The `postgres_data` volume is kept when you run `docker compose down`, so tasks remain available after containers are recreated. PostgreSQL runs `server/sql/001_create_tasks.sql` automatically only when the database volume is **first created**. To delete all tasks and recreate the schema from scratch, run `docker compose down -v` followed by `docker compose up --build`. The `down -v` command permanently deletes the data.

## Sample data for testing

After the application starts, open another terminal in the project root and run both commands. The build step updates the backend and frontend to the latest configuration:

```bash
docker compose up -d --build
docker compose exec backend npm run seed
```

If your Docker installation does not have `buildx`, prefix the first command with `DOCKER_BUILDKIT=0`. Once the backend has been updated, you only need to repeat the second command to run the seeder again.

The seeder uses Node.js and the `pg` driver. Sample tasks are defined in `server/src/seed.js` and stored in the PostgreSQL `tasks` table on the `postgres_data` volume. It adds 24 tasks, six for each status, giving you three pages of results at 10 tasks per page. Search for `laporan` to see matches across statuses, then combine the search with a status filter. Running the seeder again does not add duplicates; deleted sample tasks are recreated. Existing sample tasks with the old `[Demo]` prefix have their titles updated without being deleted.

## Project structure

- `client/`: React, Vite, Nginx, and interface styles.
- `server/`: Express API and PostgreSQL schema SQL.
- `compose.yaml`: three services (`db`, `backend`, `frontend`) and the database volume.
- `.env.example`: example configuration without real credentials.

## API

Interactive Swagger UI documentation is available at [http://localhost:8080/docs](http://localhost:8080/docs). The OpenAPI JSON specification is available at [http://localhost:8080/docs/openapi.json](http://localhost:8080/docs/openapi.json). Swagger UI's **Try it out** button calls the API on the same host.

All endpoints are under `/api/tasks`. A task has an `id` (string), `title`, `description`, `status`, `created_at`, and `updated_at`. Valid status values are `new`, `in progress`, `in testing`, and `done`.

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/tasks?status=&search=&page=1&limit=10` | List newest tasks; search title and description without case sensitivity; maximum `limit` is 100. |
| `POST` | `/api/tasks` | Create a task with `title`, optional `description`, and optional `status`; default status is `new`. |
| `PUT` | `/api/tasks/:id` | Replace a task; `title`, `description`, and `status` are required. |
| `DELETE` | `/api/tasks/:id` | Delete a task; success returns `204 No Content`. |

Example request to create a task:

```bash
curl -X POST http://localhost:8080/api/tasks \
  -H 'Content-Type: application/json' \
  -d '{"title":"Prepare presentation","description":"For Friday","status":"new"}'
```

`GET` returns `{ "data": [...], "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 } }`. Invalid input returns `400`, a task not found during update or deletion returns `404`, and server failures return `500`. Errors have the shape `{ "error": { "message": "..." } }`.
