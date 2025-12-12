# Maskfile for Journal App

## run

> Run everything (Backend + Frontend in parallel)

**OPTIONS**
* backend
    * flags: -b --backend
    * desc: Run only the backend
* frontend
    * flags: -f --frontend
    * desc: Run only the frontend

~~~bash
# Start backend in background
(cd server && npm install && npm run start) &
BACKEND_PID=$!

# Start frontend in background
(cd client && npm install && npm run dev) &
FRONTEND_PID=$!

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
~~~

## backend

> Run only the backend server

~~~bash
cd server && npm install && npm run start
echo "Swagger is available at http://localhost:3001/api-docs when backend is running"
~~~

## frontend

> Run only the frontend development server

~~~bash
cd client && npm install && npm run dev
~~~

## clean_install

> Clean install of all dependencies

~~~bash
cd server && rm -rf node_modules && npm install
cd client && rm -rf node_modules && npm install
~~~
