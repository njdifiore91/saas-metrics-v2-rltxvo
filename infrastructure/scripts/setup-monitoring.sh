#!/bin/bash

# Setup Monitoring Infrastructure Script v1.0.0
# Comprehensive monitoring stack setup for Startup Metrics Benchmarking Platform

set -euo pipefail

# Global variables
PROMETHEUS_VERSION="2.45.0"
GRAFANA_VERSION="9.5.0"
ALERTMANAGER_VERSION="0.25.0"
OTEL_COLLECTOR_VERSION="0.70.0"
ELASTICSEARCH_VERSION="8.8.0"
KIBANA_VERSION="8.8.0"
MONITORING_NAMESPACE="monitoring"
LOG_LEVEL="INFO"
BACKUP_RETENTION_DAYS="30"
METRIC_RETENTION_DAYS="90"

# Logging function
log() {
    local level=$1
    shift
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] [$level] $*"
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        log "ERROR" "kubectl not found. Please install kubectl v1.24+"
        return 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log "ERROR" "Docker not found. Please install docker-ce"
        return 1
    }
    
    # Verify cluster access
    if ! kubectl auth can-i create namespace; then
        log "ERROR" "Insufficient Kubernetes permissions"
        return 1
    }
    
    # Check namespace
    if ! kubectl get namespace "$MONITORING_NAMESPACE" &> /dev/null; then
        log "INFO" "Creating monitoring namespace"
        kubectl create namespace "$MONITORING_NAMESPACE"
    fi
    
    # Verify storage class
    if ! kubectl get storageclass &> /dev/null; then
        log "ERROR" "No storage class found"
        return 1
    }
    
    log "INFO" "Prerequisites check completed successfully"
    return 0
}

# Setup Prometheus
setup_prometheus() {
    log "INFO" "Setting up Prometheus v${PROMETHEUS_VERSION}..."
    
    # Create ConfigMap for Prometheus configuration
    kubectl create configmap prometheus-config \
        --from-file=prometheus.yml=../monitoring/prometheus/prometheus.yml \
        --from-file=rules.yml=../monitoring/prometheus/rules.yml \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Prometheus
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: prometheus
  namespace: $MONITORING_NAMESPACE
spec:
  serviceName: prometheus
  replicas: 2
  selector:
    matchLabels:
      app: prometheus
  template:
    metadata:
      labels:
        app: prometheus
    spec:
      containers:
      - name: prometheus
        image: prom/prometheus:v${PROMETHEUS_VERSION}
        args:
          - "--config.file=/etc/prometheus/prometheus.yml"
          - "--storage.tsdb.retention.time=${METRIC_RETENTION_DAYS}d"
          - "--web.enable-lifecycle"
        ports:
        - containerPort: 9090
        volumeMounts:
        - name: config
          mountPath: /etc/prometheus
        - name: data
          mountPath: /prometheus
      volumes:
      - name: config
        configMap:
          name: prometheus-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 100Gi
EOF
    
    # Create Prometheus service
    kubectl create service clusterip prometheus \
        --tcp=9090:9090 \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    log "INFO" "Prometheus setup completed"
    return 0
}

# Setup Grafana
setup_grafana() {
    log "INFO" "Setting up Grafana v${GRAFANA_VERSION}..."
    
    # Create ConfigMaps for Grafana dashboards
    kubectl create configmap grafana-dashboards \
        --from-file=../monitoring/grafana/dashboards/ \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Create ConfigMap for Grafana provisioning
    kubectl create configmap grafana-provisioning \
        --from-file=../monitoring/grafana/provisioning/ \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Grafana
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: grafana
  namespace: $MONITORING_NAMESPACE
spec:
  replicas: 2
  selector:
    matchLabels:
      app: grafana
  template:
    metadata:
      labels:
        app: grafana
    spec:
      containers:
      - name: grafana
        image: grafana/grafana:${GRAFANA_VERSION}
        ports:
        - containerPort: 3000
        volumeMounts:
        - name: dashboards
          mountPath: /var/lib/grafana/dashboards
        - name: provisioning
          mountPath: /etc/grafana/provisioning
        env:
        - name: GF_SECURITY_ADMIN_PASSWORD
          valueFrom:
            secretKeyRef:
              name: grafana-admin
              key: password
      volumes:
      - name: dashboards
        configMap:
          name: grafana-dashboards
      - name: provisioning
        configMap:
          name: grafana-provisioning
EOF
    
    # Create Grafana service
    kubectl create service clusterip grafana \
        --tcp=3000:3000 \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    log "INFO" "Grafana setup completed"
    return 0
}

# Setup Alertmanager
setup_alertmanager() {
    log "INFO" "Setting up Alertmanager v${ALERTMANAGER_VERSION}..."
    
    # Create ConfigMap for Alertmanager configuration
    kubectl create configmap alertmanager-config \
        --from-file=alertmanager.yml=../monitoring/alertmanager/alertmanager.yml \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy Alertmanager
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: alertmanager
  namespace: $MONITORING_NAMESPACE
spec:
  serviceName: alertmanager
  replicas: 2
  selector:
    matchLabels:
      app: alertmanager
  template:
    metadata:
      labels:
        app: alertmanager
    spec:
      containers:
      - name: alertmanager
        image: prom/alertmanager:v${ALERTMANAGER_VERSION}
        args:
          - "--config.file=/etc/alertmanager/alertmanager.yml"
          - "--storage.path=/alertmanager"
        ports:
        - containerPort: 9093
        volumeMounts:
        - name: config
          mountPath: /etc/alertmanager
        - name: data
          mountPath: /alertmanager
      volumes:
      - name: config
        configMap:
          name: alertmanager-config
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 10Gi
EOF
    
    # Create Alertmanager service
    kubectl create service clusterip alertmanager \
        --tcp=9093:9093 \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    log "INFO" "Alertmanager setup completed"
    return 0
}

# Setup ELK Stack for logging
setup_logging() {
    log "INFO" "Setting up ELK Stack (Elasticsearch v${ELASTICSEARCH_VERSION}, Kibana v${KIBANA_VERSION})..."
    
    # Deploy Elasticsearch
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: elasticsearch
  namespace: $MONITORING_NAMESPACE
spec:
  serviceName: elasticsearch
  replicas: 3
  selector:
    matchLabels:
      app: elasticsearch
  template:
    metadata:
      labels:
        app: elasticsearch
    spec:
      containers:
      - name: elasticsearch
        image: docker.elastic.co/elasticsearch/elasticsearch:${ELASTICSEARCH_VERSION}
        env:
        - name: discovery.type
          value: single-node
        - name: ES_JAVA_OPTS
          value: "-Xms2g -Xmx2g"
        ports:
        - containerPort: 9200
        volumeMounts:
        - name: data
          mountPath: /usr/share/elasticsearch/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      resources:
        requests:
          storage: 100Gi
EOF
    
    # Deploy Kibana
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kibana
  namespace: $MONITORING_NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kibana
  template:
    metadata:
      labels:
        app: kibana
    spec:
      containers:
      - name: kibana
        image: docker.elastic.co/kibana/kibana:${KIBANA_VERSION}
        env:
        - name: ELASTICSEARCH_HOSTS
          value: http://elasticsearch:9200
        ports:
        - containerPort: 5601
EOF
    
    # Create services
    kubectl create service clusterip elasticsearch \
        --tcp=9200:9200 \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create service clusterip kibana \
        --tcp=5601:5601 \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    log "INFO" "ELK Stack setup completed"
    return 0
}

# Setup OpenTelemetry for distributed tracing
setup_tracing() {
    log "INFO" "Setting up OpenTelemetry Collector v${OTEL_COLLECTOR_VERSION}..."
    
    # Deploy OpenTelemetry Collector
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: otel-collector
  namespace: $MONITORING_NAMESPACE
spec:
  replicas: 2
  selector:
    matchLabels:
      app: otel-collector
  template:
    metadata:
      labels:
        app: otel-collector
    spec:
      containers:
      - name: otel-collector
        image: otel/opentelemetry-collector:${OTEL_COLLECTOR_VERSION}
        ports:
        - containerPort: 4317 # OTLP gRPC
        - containerPort: 4318 # OTLP HTTP
        - containerPort: 8888 # Prometheus metrics
EOF
    
    # Create service
    kubectl create service clusterip otel-collector \
        --tcp=4317:4317,4318:4318,8888:8888 \
        -n "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    log "INFO" "OpenTelemetry setup completed"
    return 0
}

# Verify monitoring stack
verify_monitoring_stack() {
    log "INFO" "Verifying monitoring stack deployment..."
    
    # Check all pods are running
    local pods_ready=0
    while [ $pods_ready -eq 0 ]; do
        if kubectl get pods -n "$MONITORING_NAMESPACE" | grep -v Running | grep -v Completed | tail -n +2 | wc -l | grep -q "^0$"; then
            pods_ready=1
        else
            log "INFO" "Waiting for all pods to be ready..."
            sleep 10
        fi
    done
    
    # Verify services are responding
    local services=("prometheus:9090/metrics" "grafana:3000" "alertmanager:9093/-/healthy" "elasticsearch:9200/_cluster/health" "kibana:5601/api/status" "otel-collector:8888/metrics")
    
    for service in "${services[@]}"; do
        IFS=: read -r name port_path <<< "$service"
        if ! kubectl run curl-test-"$name" --image=curlimages/curl --restart=Never -n "$MONITORING_NAMESPACE" \
            --command -- curl -s "http://$name:$port_path" > /dev/null; then
            log "ERROR" "Service $name is not responding"
            return 1
        fi
        kubectl delete pod curl-test-"$name" -n "$MONITORING_NAMESPACE"
    done
    
    log "INFO" "Monitoring stack verification completed successfully"
    return 0
}

# Main execution
main() {
    log "INFO" "Starting monitoring stack setup..."
    
    # Execute setup steps
    check_prerequisites || exit 1
    setup_prometheus || exit 1
    setup_grafana || exit 1
    setup_alertmanager || exit 1
    setup_logging || exit 1
    setup_tracing || exit 1
    verify_monitoring_stack || exit 1
    
    log "INFO" "Monitoring stack setup completed successfully"
}

main "$@"