FROM alpine:3.21

ARG PB_VERSION=0.40.4
ARG TARGETARCH

RUN apk add --no-cache ca-certificates unzip \
    && wget -qO /tmp/pb.zip \
        "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" \
    && unzip -o /tmp/pb.zip pocketbase -d /usr/local/bin \
    && rm /tmp/pb.zip \
    && chmod +x /usr/local/bin/pocketbase

WORKDIR /pb
COPY pb_migrations /pb/pb_migrations
COPY docker/entrypoint.sh /pb/entrypoint.sh
RUN chmod +x /pb/entrypoint.sh

EXPOSE 8090
VOLUME ["/pb/pb_data"]
ENTRYPOINT ["/pb/entrypoint.sh"]
