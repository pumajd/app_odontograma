/**
 * ReciboPDF — Plantilla de recibo/factura generada con @react-pdf/renderer
 * Se renderiza completamente en el cliente (no requiere backend).
 */
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const AZUL  = '#0369a1'
const GRIS  = '#6b7280'
const BORDE = '#e5e7eb'

const s = StyleSheet.create({
  page:         { fontFamily: 'Helvetica', fontSize: 10, padding: 40, color: '#111827' },
  header:       { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  logoText:     { fontSize: 22, fontFamily: 'Helvetica-Bold', color: AZUL },
  logoSub:      { fontSize: 9, color: GRIS, marginTop: 2 },
  reciboBadge:  { backgroundColor: AZUL, color: '#fff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, fontSize: 9, fontFamily: 'Helvetica-Bold' },
  seccion:      { marginBottom: 16 },
  seccionTit:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRIS, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  table:        { marginTop: 8 },
  tableHead:    { flexDirection: 'row', backgroundColor: '#f3f4f6', paddingVertical: 5, paddingHorizontal: 4, borderRadius: 3 },
  tableRow:     { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 4, borderBottom: `1px solid ${BORDE}` },
  col5:         { flex: 5 },
  col2:         { flex: 2, textAlign: 'center' },
  col2r:        { flex: 2, textAlign: 'right' },
  thText:       { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRIS },
  totales:      { marginTop: 10, alignItems: 'flex-end' },
  totalRow:     { flexDirection: 'row', gap: 40, marginBottom: 3 },
  totalLabel:   { fontSize: 9, color: GRIS, width: 80, textAlign: 'right' },
  totalVal:     { fontSize: 9, width: 60, textAlign: 'right' },
  totalFinal:   { fontFamily: 'Helvetica-Bold', fontSize: 12, color: AZUL },
  footer:       { position: 'absolute', bottom: 30, left: 40, right: 40, borderTop: `1px solid ${BORDE}`, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:   { fontSize: 8, color: GRIS },
})

export default function ReciboPDF({ factura }) {
  const { paciente, items = [], subtotal = 0, iva = 0, total = 0, metodo_pago, observaciones, numero, fecha_emision } = factura

  const fecha = fecha_emision
    ? format(new Date(fecha_emision), "d 'de' MMMM yyyy", { locale: es })
    : '—'

  return (
    <Document title={`Recibo ${numero || ''} - ODONTOVAL`}>
      <Page size="A4" style={s.page}>

        {/* Encabezado */}
        <View style={s.header}>
          <View>
            <Text style={s.logoText}>🦷 ODONTOVAL</Text>
            <Text style={s.logoSub}>Sistema de Gestión Odontológica</Text>
            <Text style={[s.logoSub, { marginTop: 1 }]}>odontoval.com.ec · info@odontoval.com.ec</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={s.reciboBadge}><Text>RECIBO DE PAGO</Text></View>
            {numero && <Text style={[s.logoSub, { marginTop: 6 }]}>N° {numero}</Text>}
            <Text style={[s.logoSub, { marginTop: 2 }]}>{fecha}</Text>
          </View>
        </View>

        {/* Datos del paciente */}
        <View style={s.seccion}>
          <Text style={s.seccionTit}>Datos del paciente</Text>
          <View style={{ flexDirection: 'row', gap: 40 }}>
            <View>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>
                {paciente?.apellidos}, {paciente?.nombres}
              </Text>
              <Text style={{ color: GRIS, marginTop: 2 }}>C.I.: {paciente?.cedula}</Text>
            </View>
            <View>
              {paciente?.telefono && <Text style={{ color: GRIS }}>Tel: {paciente.telefono}</Text>}
              {paciente?.email    && <Text style={{ color: GRIS }}>Email: {paciente.email}</Text>}
            </View>
          </View>
        </View>

        {/* Items */}
        <View style={s.seccion}>
          <Text style={s.seccionTit}>Detalle de servicios</Text>
          <View style={s.table}>
            {/* Encabezado tabla */}
            <View style={s.tableHead}>
              <Text style={[s.thText, s.col5]}>Descripción</Text>
              <Text style={[s.thText, s.col2]}>Cant.</Text>
              <Text style={[s.thText, s.col2r]}>P. Unitario</Text>
              <Text style={[s.thText, s.col2r]}>Subtotal</Text>
            </View>
            {/* Filas */}
            {items.filter(it => it.descripcion).map((it, i) => (
              <View key={i} style={s.tableRow}>
                <Text style={s.col5}>{it.descripcion}</Text>
                <Text style={s.col2}>{it.cantidad}</Text>
                <Text style={s.col2r}>${parseFloat(it.precio_unitario || 0).toFixed(2)}</Text>
                <Text style={s.col2r}>${((parseFloat(it.precio_unitario) || 0) * it.cantidad).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totales */}
        <View style={s.totales}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>Subtotal</Text>
            <Text style={s.totalVal}>${subtotal.toFixed(2)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>IVA (15%)</Text>
            <Text style={s.totalVal}>${iva.toFixed(2)}</Text>
          </View>
          <View style={s.totalRow}>
            <Text style={[s.totalLabel, s.totalFinal]}>TOTAL</Text>
            <Text style={[s.totalVal, s.totalFinal]}>${total.toFixed(2)}</Text>
          </View>
          <Text style={[s.logoSub, { marginTop: 4 }]}>
            Método de pago: {metodo_pago || 'efectivo'}
          </Text>
        </View>

        {/* Observaciones */}
        {observaciones && (
          <View style={[s.seccion, { marginTop: 16 }]}>
            <Text style={s.seccionTit}>Observaciones</Text>
            <Text style={{ color: GRIS }}>{observaciones}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>ODONTOVAL · odontoval.com.ec</Text>
          <Text style={s.footerText}>Documento generado el {fecha}</Text>
        </View>
      </Page>
    </Document>
  )
}
