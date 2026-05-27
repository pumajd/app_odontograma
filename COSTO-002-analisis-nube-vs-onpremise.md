# COSTO-002 — Análisis de Costos: AWS vs GCP vs On-Premise
**Proyecto:** ODONTOVAL — Sistema de Gestión Odontológica  
**Versión:** 1.0  
**Fecha:** 2026-05-26  
**Autor:** Arquitectura ODONTOVAL  

---

## 1. Resumen Ejecutivo

Este documento analiza el costo total de propiedad (TCO) a 3 años para alojar el sistema ODONTOVAL en tres escenarios:

| Escenario | Costo Año 1 | Costo Año 2 | Costo Año 3 | TCO 3 años |
|-----------|------------|------------|------------|------------|
| **AWS** *(actual + nuevos servicios)* | **~$16/año** | **~$222/año** | **~$222/año** | **~$460** |
| **GCP** | ~$156/año | ~$204/año | ~$204/año | ~$564 |
| **On-Premise** | ~$1.800/año | ~$1.200/año | ~$1.200/año | ~$4.200 |

**Recomendación:** Continuar con **AWS**. Ya existe infraestructura desplegada (S3, CloudFront, SES, Lambda, Route 53), el costo del primer año es mínimo gracias al Free Tier, y los servicios nuevos requeridos tienen equivalencia directa sin migración.

---

## 2. Alcance del Sistema

### 2.1 Infraestructura ya desplegada (AWS)

| Recurso | Servicio AWS | Bucket/ID |
|---------|-------------|-----------|
| Sitio estático React (PWA) | S3 + CloudFront | `odontoval-site-prod` |
| Correo electrónico | SES + Lambda + S3 | `odontoval-prod-emails` |
| Reenvío de correos | Lambda Python 3.12 | `odontoval-prod-email-forwarder` |
| DNS | Route 53 | zona `odontoval.com.ec` |
| Estado Terraform | S3 | `odontoval-tfstate-prod` |

### 2.2 Nuevos servicios requeridos

| Necesidad | AWS | GCP |
|-----------|-----|-----|
| Autenticación Google OAuth | Cognito User Pool | Firebase Authentication |
| Base de datos relacional | RDS PostgreSQL (db.t3.micro) | Cloud SQL PostgreSQL (db-f1-micro) |
| API REST del backend | API Gateway + Lambda | Cloud Run o Cloud Functions |
| Almacenamiento radiografías | S3 | Cloud Storage |
| Recordatorios / cron jobs | EventBridge Scheduler | Cloud Scheduler |
| Monitoreo y logs | CloudWatch | Cloud Logging |
| CI/CD | GitHub Actions (existente) | Cloud Build |

---

## 3. Análisis AWS

### 3.1 Infraestructura actual — costos mensuales

| Servicio | Free Tier | Uso estimado (≤10 clínicas) | Costo/mes |
|----------|-----------|----------------------------|-----------|
| S3 (sitio + emails + tfstate) | 5 GB gratis | ~200 MB | **$0.00** |
| CloudFront | 1 TB transferencia + 10 M req/mes | ~5 GB, 50K req | **$0.00** |
| SES (envío) | 62.000 emails/mes desde Lambda | ~200 emails/mes | **$0.00** |
| Lambda (forwarder) | 1 M req + 400K GB-s siempre gratis | <1K req/mes | **$0.00** |
| Route 53 (zona) | No incluida en free tier | 1 zona | **$0.50** |
| **Subtotal actual** | | | **$0.50/mes** |

### 3.2 Nuevos servicios — costos mensuales

#### Año 1 (Free Tier activo — 12 meses desde primer uso)

| Servicio | Free Tier | Uso estimado | Costo/mes |
|----------|-----------|--------------|-----------|
| Cognito User Pool | 50.000 MAU gratis | ≤1.000 MAU (10 usuarios × 100 clínicas) | **$0.00** |
| RDS PostgreSQL db.t3.micro | 750 horas/mes + 20 GB gratis × 12 meses | 730 horas, 10 GB | **$0.00** |
| API Gateway REST | 1 M llamadas/mes × 12 meses | ~100K llamadas/mes | **$0.00** |
| Lambda backend | 1 M req + 400K GB-s siempre gratis | ~100K req/mes | **$0.00** |
| S3 radiografías | 5 GB + 20K GET + 2K PUT × 12 meses | ~2 GB/mes | **$0.00** |
| EventBridge Scheduler | 14 M invocaciones siempre gratis | ~300/mes | **$0.00** |
| CloudWatch Logs | 5 GB ingestión siempre gratis | ~500 MB/mes | **$0.00** |
| **Subtotal nuevos (año 1)** | | | **$0.00/mes** |
| **TOTAL AWS AÑO 1** | | | **$0.50/mes ≈ $6/año** |

> **Nota:** Se suma el dominio `odontoval.com.ec` vía NIC.EC: **~$15/año** → **Total año 1: ~$21/año**

#### Año 2+ (Post Free Tier)

| Servicio | Precio | Uso estimado | Costo/mes |
|----------|--------|--------------|-----------|
| Route 53 zona | $0.50/zona | 1 zona | **$0.50** |
| Cognito | Gratis ≤50K MAU | ≤1.000 MAU | **$0.00** |
| RDS PostgreSQL db.t3.micro | $0.017/hora (on-demand) | 730 horas | **$12.41** |
| RDS Storage 20 GB | $0.115/GB-mes | 20 GB | **$2.30** |
| API Gateway REST | $3.50/millón de llamadas | 100K llamadas | **$0.35** |
| Lambda backend | $0.20/millón req (1M siempre gratis) | < 1M req | **$0.00** |
| S3 radiografías | $0.023/GB | 5 GB acumulados | **$0.12** |
| EventBridge Scheduler | Gratis ≤14M/mes | ~300/mes | **$0.00** |
| CloudWatch Logs | $0.50/GB sobre 5 GB | ~500 MB | **$0.00** |
| SES (envío) | $0.10/1.000 emails | ~200 emails | **$0.02** |
| **TOTAL AWS AÑO 2+** | | | **~$15.70/mes ≈ $188/año** |

> Sumando dominio: **~$203/año** a partir del segundo año.

### 3.3 Ventajas AWS para ODONTOVAL

- ✅ Infraestructura ya desplegada — zero migración
- ✅ SES con dominio `odontoval.com.ec` ya verificado (DKIM configurado)
- ✅ Cognito tiene free tier permanente suficiente para el volumen proyectado
- ✅ Un solo proveedor → un solo billing, un solo IAM, un solo Terraform provider
- ✅ GitHub Actions CI/CD ya existe en el repo `terraform_pagina_aws`
- ✅ Costo año 1 prácticamente cero

### 3.4 Desventajas AWS

- ⚠️ RDS db.t3.micro es la instancia más pequeña; si crece, el costo sube a ~$30-50/mes
- ⚠️ Free Tier de RDS solo dura 12 meses (por cuenta, no por proyecto)
- ⚠️ API Gateway tiene costo por llamada (aunque mínimo a este volumen)

---

## 4. Análisis GCP

### 4.1 Equivalencias de servicios

| Función | AWS (actual) | GCP (equivalente) |
|---------|-------------|-------------------|
| Hosting estático | S3 + CloudFront | Firebase Hosting |
| Autenticación | Cognito | Firebase Authentication |
| Base de datos | RDS PostgreSQL | Cloud SQL PostgreSQL |
| API / Backend | API Gateway + Lambda | Cloud Run |
| Almacenamiento archivos | S3 | Cloud Storage |
| Correo (envío) | SES | SendGrid / Mailgun (3rd party) |
| Correo (recepción) | SES Receipt Rules | **No disponible nativamente** |
| DNS | Route 53 | Cloud DNS |
| Cron jobs | EventBridge | Cloud Scheduler |
| CI/CD | GitHub Actions | Cloud Build |
| Logs | CloudWatch | Cloud Logging |

> ⚠️ **GCP no tiene servicio equivalente a SES para recepción de correos.** Se requeriría un servicio de terceros (SendGrid Inbound Parse, Mailgun) o una VM adicional para procesar correos entrantes — costo extra y complejidad mayor.

### 4.2 Costos mensuales GCP

#### Plan Spark Firebase (gratuito) — límites

| Servicio | Límite gratuito | ¿Suficiente? |
|----------|----------------|--------------|
| Firebase Hosting | 10 GB storage, 360 MB/día transferencia | ✅ Sí (sitio estático ~50 MB) |
| Firebase Authentication | Google Sign-In ilimitado en Spark | ✅ Sí |
| Cloud Firestore | 1 GB, 50K lecturas/día | ⚠️ No aplica (usamos SQL) |

#### Servicios con costo mensual

| Servicio | Precio | Uso estimado | Costo/mes |
|----------|--------|--------------|-----------|
| Cloud SQL PostgreSQL (db-f1-micro) | $7.67/mes | Siempre activo | **$7.67** |
| Cloud SQL Storage 10 GB SSD | $0.170/GB | 10 GB | **$1.70** |
| Cloud Run | $0.00002400/vCPU-s + $0.0000025/GB-s | ~100K req/mes | **~$2.00** |
| Cloud Storage (radiografías) | $0.020/GB | 5 GB | **$0.10** |
| Cloud DNS | $0.20/zona + $0.40/M queries | 1 zona, 100K queries | **$0.24** |
| Cloud Scheduler | 3 jobs gratis, luego $0.10/job | 3-5 jobs | **$0.20** |
| Cloud Logging | Primeros 50 GB gratis | <1 GB | **$0.00** |
| **Recepción correos (SendGrid Essentials)** | $19.95/mes (40K emails/mes) | Necesario | **$9.98** *(pro-rated básico)* |
| **TOTAL GCP** | | | **~$21.89/mes ≈ $263/año** |

> Sumando dominio `odontoval.com.ec`: **~$278/año**

> **Nota sobre correo:** GCP no tiene recepción de correo nativa. El setup actual de SES (recepción + reenvío a Gmail) tendría que reemplazarse con SendGrid Inbound Parse ($19.95/mes plan básico) o similar. Esto añade complejidad y costo significativo.

### 4.3 Ventajas GCP para ODONTOVAL

- ✅ Firebase Auth con Google Sign-In: integración nativa, muy fácil
- ✅ Firebase Hosting gratuito es suficiente para el sitio estático
- ✅ Cloud Run escala a cero (no paga si no hay tráfico)
- ✅ Buena documentación y UX de consola

### 4.4 Desventajas GCP para ODONTOVAL

- ❌ No hay equivalente a SES para recepción de correos → tercero obligatorio
- ❌ Cloud SQL no tiene free tier equivalente al de RDS → costo desde día 1
- ❌ Migración completa requerida (S3 → Cloud Storage, CloudFront → Firebase Hosting, SES → SendGrid)
- ❌ Terraform tendría dos providers (AWS para lo existente, GCP para lo nuevo) → complejidad operacional
- ❌ La verificación DKIM de dominio en SES tendría que rehacerse para SendGrid
- ❌ Mayor costo desde el primer mes

---

## 5. Análisis On-Premise

### 5.1 Infraestructura requerida

Para una clínica dental pequeña con acceso desde internet, se necesita:

| Componente | Descripción | Costo estimado |
|------------|-------------|----------------|
| Mini servidor | Intel NUC o similar (8 GB RAM, SSD 256 GB) | $450 – $600 |
| UPS (respaldo eléctrico) | APC Back-UPS 650VA | $80 – $120 |
| Router con IP estática | Proveedor ISP Ecuador (CNT/Netlife) | Incluido en contrato |
| Disco externo backup | 1 TB USB | $50 – $70 |
| **Total hardware (único)** | | **$580 – $790** |

### 5.2 Costos mensuales operativos

| Concepto | Detalle | Costo/mes |
|----------|---------|-----------|
| Internet empresarial con IP fija | CNT/Netlife Ecuador, 50 Mbps simétrico | $60 – $80 |
| Electricidad servidor | ~100W × 24h × 30 días = 72 kWh a $0.10/kWh | $7.20 |
| UPS electricidad | ~20W adicionales | $1.44 |
| Dominio `odontoval.com.ec` | NIC.EC $15/año | $1.25 |
| SSL (Let's Encrypt) | Gratuito, renovación automática | $0.00 |
| Backup en nube (Google Drive 200 GB) | Plan personal | $3.00 |
| **Total mensual operativo** | | **~$73 – $93/mes** |

### 5.3 Costos ocultos y riesgos

| Riesgo | Impacto | Costo potencial |
|--------|---------|----------------|
| Fallo de hardware | Pérdida de datos / downtime | $400 – $600 reemplazo |
| Corte de luz (Ecuador) | Sin UPS extendida: downtime ~2-4h | Pérdida de productividad |
| Corte de internet | Sistema inaccesible | $0 (sin solución) |
| Mantenimiento / actualizaciones | Tiempo técnico | $50-100/hora |
| Sin escalabilidad | Si crece la clínica, se reemplaza el server | $600+ |
| Seguridad física | Sin datacenter seguro | Riesgo de robo |

### 5.4 Costo total on-premise a 3 años

| Período | Costo |
|---------|-------|
| Año 1 (hardware + operativo) | $580 + ($83 × 12) = **~$1.576** |
| Año 2 (solo operativo) | $83 × 12 = **~$996** |
| Año 3 (operativo + reemplazo parcial) | $996 + $200 mantenimiento = **~$1.196** |
| **TCO 3 años** | **~$3.768** |

### 5.5 Ventajas On-Premise

- ✅ Control total de los datos (relevante para datos clínicos sensibles)
- ✅ Sin dependencia de proveedor cloud

### 5.6 Desventajas On-Premise

- ❌ Alto costo inicial de hardware
- ❌ Sin alta disponibilidad (si el server falla, todo cae)
- ❌ Cortes de luz frecuentes en Ecuador impactan la operación
- ❌ Requiere mantenimiento técnico continuo
- ❌ No cumple con buenas prácticas de backup geográficamente distribuido
- ❌ Escalabilidad limitada: para más recursos se compra nuevo hardware
- ❌ Sin CDN → carga lenta para usuarios remotos
- ❌ Responsabilidad de parches de seguridad recae en el operador

---

## 6. Tabla Comparativa Global

| Criterio | AWS | GCP | On-Premise |
|----------|-----|-----|------------|
| **Costo Año 1** | ~$21 | ~$278 | ~$1.576 |
| **Costo Año 2** | ~$203 | ~$278 | ~$996 |
| **Costo Año 3** | ~$203 | ~$278 | ~$1.196 |
| **TCO 3 años** | **~$427** | **~$834** | **~$3.768** |
| Infraestructura existente | ✅ Ya desplegada | ❌ Migración total | ❌ Compra hardware |
| Free Tier año 1 | ✅ Muy generoso | ⚠️ Parcial | ❌ No aplica |
| Recepción de correo | ✅ SES nativo | ❌ Tercero ($20/mes) | ⚠️ Postfix/manual |
| Google OAuth | ✅ Cognito | ✅ Firebase Auth | ⚠️ OAuth library propia |
| Alta disponibilidad | ✅ SLA 99.9%+ | ✅ SLA 99.9%+ | ❌ Sin SLA |
| Escalabilidad | ✅ Automática | ✅ Automática | ❌ Manual |
| Terraform soporte | ✅ Provider único | ⚠️ Provider adicional | ⚠️ Parcial |
| Complejidad operativa | Baja | Media | Alta |
| Cumplimiento LOPD/datos | ✅ Regiones dedicadas | ✅ Regiones dedicadas | ⚠️ Responsabilidad total |

---

## 7. Proyección de Crecimiento

Escenario: crecimiento a 50 clínicas activas, 500 pacientes/mes, 10 GB radiografías

| Servicio AWS | Uso proyectado | Costo/mes (año 3) |
|-------------|---------------|-------------------|
| Cognito (≤50K MAU) | 500 MAU | **$0.00** |
| RDS db.t3.micro → db.t3.small | Mayor carga | **$27.74** |
| RDS Storage 50 GB | Crecimiento datos | **$5.75** |
| API Gateway | 500K llamadas/mes | **$1.75** |
| Lambda | <1M req | **$0.00** |
| S3 radiografías | 10 GB/mes acumulado | **$2.30** |
| CloudFront | 20 GB transferencia | **$1.70** |
| SES | 2.000 emails/mes | **$0.14** |
| EventBridge | ~1.500 invocaciones | **$0.00** |
| Route 53 | 1 zona | **$0.50** |
| **TOTAL CRECIMIENTO** | | **~$39.88/mes ≈ $479/año** |

---

## 8. Decisión Recomendada

### ✅ Continuar con AWS — Justificación

1. **Costo mínimo año 1:** ~$21 totales (solo dominio + Route 53). Los nuevos servicios (RDS, Cognito, API Gateway, Lambda) están dentro del Free Tier durante 12 meses.

2. **Infraestructura ya funcional:** S3, CloudFront, SES, Lambda y Route 53 están desplegados, el dominio verificado, los registros DKIM configurados. Migrar a GCP requeriría rehacer todo esto.

3. **Recepción de correo:** SES es el único servicio cloud gestionado con recepción de correo nativa. GCP requeriría contratar SendGrid (~$20/mes adicionales).

4. **Terraform unificado:** Un solo provider `hashicorp/aws`, modules ya escritos, estado en S3. Añadir GCP requeriría un segundo provider y duplicar la configuración de IaC.

5. **TCO 3 años más bajo:** AWS $427 vs GCP $834 vs On-Premise $3.768.

6. **Escalabilidad sin re-arquitectura:** Si ODONTOVAL crece a 200 clínicas, solo se sube el tipo de instancia RDS. No hay cambio de proveedor ni migración de datos.

---

## 9. Próximos Módulos Terraform (AWS)

Para completar la infraestructura del backend, se requiere crear los siguientes módulos adicionales:

| Módulo | Servicios | Prioridad |
|--------|----------|-----------|
| `modules/auth` | Cognito User Pool + Google IdP + Hosted UI | Alta |
| `modules/database` | RDS PostgreSQL + Parameter Group + Security Group | Alta |
| `modules/api` | API Gateway REST + Lambda backend + IAM roles | Alta |
| `modules/scheduler` | EventBridge Scheduler + Lambda reminders | Media |
| `modules/storage` | S3 bucket radiografías + políticas CORS | Media |

---

*Documento generado para el proyecto ODONTOVAL. Precios basados en tarifas públicas de AWS (us-east-1) y GCP (us-central1) vigentes en mayo 2026. Los precios pueden variar; se recomienda validar en la calculadora oficial de cada proveedor antes de presupuestar.*
