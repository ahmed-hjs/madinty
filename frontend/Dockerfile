FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install

FROM node:22-alpine AS dev
WORKDIR /app
RUN npm install -g @angular/cli
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 4200
CMD ["ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]

FROM deps AS build
COPY . .
RUN npx ng build --configuration production

FROM nginx:alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
EXPOSE 80
