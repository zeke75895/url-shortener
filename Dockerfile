# ---------- Build stage ----------
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app

# Download dependencies first so this layer is cached until pom.xml changes
COPY pom.xml .
RUN mvn -B dependency:go-offline

COPY src ./src
# Tests run locally with ./mvnw test; skip them here to keep image builds fast
RUN mvn -B package -DskipTests

# ---------- Runtime stage ----------
# JRE-only image (no compiler or Maven); multi-arch, so it runs on Apple Silicon and x86
FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=build /app/target/url-shortener-*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=docker

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
