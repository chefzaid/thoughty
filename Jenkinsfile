pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = credentials('docker-registry-url')   // Configure in Jenkins credentials
        IMAGE_TAG       = "${env.BUILD_NUMBER}-${env.GIT_COMMIT?.take(7) ?: 'latest'}"
        KUBE_NAMESPACE  = 'application'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    triggers {
        // Runs the full verification pipeline daily; the Playwright stage catches UI regressions even without a PR.
        cron('H H * * *')
    }

    stages {

        // ── Install ──────────────────────────────────────────────
        stage('Install Dependencies') {
            parallel {
                stage('Server Deps') {
                    steps {
                        dir('thoughty-server') {
                            sh 'npm ci'
                        }
                    }
                }
                stage('Web Deps') {
                    steps {
                        dir('thoughty-web') {
                            sh 'npm ci'
                            sh 'npm run test:e2e:install'
                        }
                    }
                }
            }
        }

        // ── Lint ─────────────────────────────────────────────────
        stage('Lint') {
            parallel {
                stage('Server Lint') {
                    steps {
                        dir('thoughty-server') {
                            sh 'npm run lint'
                        }
                    }
                }
                stage('Web Lint') {
                    steps {
                        dir('thoughty-web') {
                            sh 'npm run lint'
                        }
                    }
                }
            }
        }

        stage('Validate Deployment Manifests') {
            steps {
                sh 'kubectl kustomize k8s/ds-cluster > /dev/null'
                sh 'kubectl kustomize k8s/ds-cluster-worker > /dev/null'
                sh 'kubectl kustomize k8s/ds-cluster-canary > /dev/null'
            }
        }

        // ── Test ─────────────────────────────────────────────────
        stage('Test') {
            parallel {
                stage('Server Tests') {
                    steps {
                        dir('thoughty-server') {
                            sh 'npm run test:cov'
                        }
                    }
                    post {
                        always {
                            dir('thoughty-server') {
                                junit allowEmptyResults: true, testResults: 'coverage/junit.xml'
                            }
                        }
                    }
                }
                stage('Web Tests') {
                    steps {
                        dir('thoughty-web') {
                            sh 'npm run test:coverage'
                        }
                    }
                    post {
                        always {
                            dir('thoughty-web') {
                                junit allowEmptyResults: true, testResults: 'coverage/junit.xml'
                            }
                        }
                    }
                }
                stage('Web E2E Tests') {
                    steps {
                        dir('thoughty-web') {
                            sh 'npm run test:e2e'
                        }
                    }
                    post {
                        always {
                            dir('thoughty-web') {
                                archiveArtifacts allowEmptyArchive: true, artifacts: 'playwright-report/**,test-results/**'
                            }
                        }
                    }
                }
            }
        }

        // ── Dependency Vulnerability Scan ───────────────────────
        stage('Dependency Audit') {
            parallel {
                stage('Server Audit') {
                    steps {
                        dir('thoughty-server') {
                            sh 'npm audit --audit-level=high'
                        }
                    }
                }
                stage('Web Audit') {
                    steps {
                        dir('thoughty-web') {
                            sh 'npm audit --audit-level=high'
                        }
                    }
                }
            }
        }

        // ── Build Docker Images ──────────────────────────────────
        stage('Build Images') {
            parallel {
                stage('Build Server Image') {
                    steps {
                        dir('thoughty-server') {
                            sh "docker build -t ${DOCKER_REGISTRY}/thoughty-server:${IMAGE_TAG} ."
                            sh "docker tag ${DOCKER_REGISTRY}/thoughty-server:${IMAGE_TAG} ${DOCKER_REGISTRY}/thoughty-server:latest"
                        }
                    }
                }
                stage('Build Web Image') {
                    steps {
                        dir('thoughty-web') {
                            // VITE_GOOGLE_CLIENT_ID is a public client ID, not a secret.
                            // Set it as a Jenkins env var to enable Google sign-in; defaults to empty.
                            sh """
                                docker build \
                                    --build-arg VITE_GOOGLE_CLIENT_ID="\${VITE_GOOGLE_CLIENT_ID:-}" \
                                    -t ${DOCKER_REGISTRY}/thoughty-web:${IMAGE_TAG} .
                            """
                            sh "docker tag ${DOCKER_REGISTRY}/thoughty-web:${IMAGE_TAG} ${DOCKER_REGISTRY}/thoughty-web:latest"
                        }
                    }
                }
            }
        }

        // ── Smoke Test Built Server Image ──────────────────────
        stage('Smoke Test Server Image') {
            steps {
                sh '''
                    set -eu

                    NETWORK="thoughty-ci-${BUILD_NUMBER}"
                    POSTGRES_CONTAINER="thoughty-ci-db-${BUILD_NUMBER}"

                    cleanup() {
                        docker rm -f "$POSTGRES_CONTAINER" >/dev/null 2>&1 || true
                        docker network rm "$NETWORK" >/dev/null 2>&1 || true
                    }

                    trap cleanup EXIT

                    docker network create "$NETWORK" >/dev/null
                    docker run -d --name "$POSTGRES_CONTAINER" --network "$NETWORK" \
                        -e POSTGRES_USER=postgres \
                        -e POSTGRES_PASSWORD=password \
                        -e POSTGRES_DB=journal \
                        postgres:16-alpine >/dev/null

                    ready=false
                    for i in $(seq 1 30); do
                        if docker exec "$POSTGRES_CONTAINER" pg_isready -U postgres -d journal >/dev/null 2>&1; then
                            ready=true
                            break
                        fi

                        sleep 2
                    done

                    if [ "$ready" != true ]; then
                        echo "PostgreSQL did not become ready in time"
                        exit 1
                    fi

                    docker run --rm --network "$NETWORK" \
                        -e POSTGRES_HOST="$POSTGRES_CONTAINER" \
                        -e POSTGRES_PORT=5432 \
                        -e POSTGRES_USER=postgres \
                        -e POSTGRES_PASSWORD=password \
                        -e POSTGRES_DB=journal \
                        ${DOCKER_REGISTRY}/thoughty-server:${IMAGE_TAG} \
                        npm run db:migrate:dist
                '''
            }
        }

        // ── Push Images ──────────────────────────────────────────
        stage('Push Images') {
            when {
                branch 'main'
            }
            steps {
                withCredentials([usernamePassword(
                    credentialsId: 'docker-registry-creds',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {
                    sh 'echo "$DOCKER_PASS" | docker login "$DOCKER_REGISTRY" -u "$DOCKER_USER" --password-stdin'
                    sh "docker push ${DOCKER_REGISTRY}/thoughty-server:${IMAGE_TAG}"
                    sh "docker push ${DOCKER_REGISTRY}/thoughty-server:latest"
                    sh "docker push ${DOCKER_REGISTRY}/thoughty-web:${IMAGE_TAG}"
                    sh "docker push ${DOCKER_REGISTRY}/thoughty-web:latest"
                }
            }
        }

        // ── Deploy to Kubernetes ─────────────────────────────────
        stage('Deploy') {
            when {
                branch 'main'
            }
            steps {
                withKubeConfig(credentialsId: 'kubeconfig') {
                    // DS-Cluster owns the application namespace, PostgreSQL, Redis,
                    // ingress controller, Vault, and External Secrets Operator.
                    sh """
                        if kubectl get deployment/thoughty-cloud-sync-worker -n ${KUBE_NAMESPACE} > /dev/null 2>&1; then
                            kubectl scale deployment/thoughty-cloud-sync-worker --replicas=0 -n ${KUBE_NAMESPACE}
                            kubectl rollout status deployment/thoughty-cloud-sync-worker -n ${KUBE_NAMESPACE} --timeout=120s
                        fi
                    """
                    sh 'kubectl apply -k k8s/ds-cluster'
                    sh "kubectl wait --for=condition=Ready externalsecret/thoughty-database externalsecret/thoughty-app externalsecret/thoughty-backup -n ${KUBE_NAMESPACE} --timeout=120s"

                    // Update image tags to trigger rollout
                    sh "kubectl set image deployment/thoughty-server thoughty-server=${DOCKER_REGISTRY}/thoughty-server:${IMAGE_TAG} -n ${KUBE_NAMESPACE}"

                    // Roll server first so migrations run before the worker starts polling.
                    sh "kubectl rollout status deployment/thoughty-server -n ${KUBE_NAMESPACE} --timeout=120s"

                    // External Secrets materializes database credentials as container
                    // environment variables, which are inherited by kubectl exec.
                    sh "kubectl exec deployment/thoughty-server -n ${KUBE_NAMESPACE} -- npm run db:migrate:dist"

                    // Deploy the worker only after migrations pass.
                    sh """
                        kubectl kustomize k8s/ds-cluster-worker |
                            kubectl set image -f - thoughty-cloud-sync-worker=${DOCKER_REGISTRY}/thoughty-server:${IMAGE_TAG} --local -o yaml |
                            kubectl apply -f -
                    """

                    // Update the web surface already created by the core overlay.
                    sh "kubectl set image deployment/thoughty-web thoughty-web=${DOCKER_REGISTRY}/thoughty-web:${IMAGE_TAG} -n ${KUBE_NAMESPACE}"

                    // Wait for rollouts
                    sh "kubectl rollout status deployment/thoughty-cloud-sync-worker -n ${KUBE_NAMESPACE} --timeout=120s"
                    sh "kubectl rollout status deployment/thoughty-web -n ${KUBE_NAMESPACE} --timeout=120s"
                }
            }
        }
    }

    post {
        failure {
            echo 'Pipeline failed — check stage logs above for details.'
        }
        success {
            echo 'Pipeline completed successfully.'
        }
        always {
            cleanWs()
        }
    }
}
