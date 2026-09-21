FROM registry.cn-shenzhen.aliyuncs.com/teable/teable@sha256:6199e9f1015174998f227219b81bf8f68b8669d690f9081cd1811841c987fc2d
WORKDIR /shoe
COPY package.json ./
COPY analysis-web ./analysis-web
COPY fixtures ./fixtures
ENV ANALYSIS_HOST=0.0.0.0 ANALYSIS_PORT=8088 DATA_MODE=teable
EXPOSE 8088
ENTRYPOINT []
CMD ["node", "analysis-web/server.js"]
