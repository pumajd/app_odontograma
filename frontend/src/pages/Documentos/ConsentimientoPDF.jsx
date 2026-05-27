import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

const AZUL  = '#0369a1'
const GRIS  = '#6b7280'
const BORDE = '#e5e7eb'

const s = StyleSheet.create({
  page:       { fontFamily: 'Helvetica', fontSize: 10, padding: 50, color: '#111827', lineHeight: 1.6 },
  titulo:     { fontSize: 16, fontFamily: 'Helvetica-Bold', color: AZUL, textAlign: 'center', marginBottom: 4 },
  subtitulo:  { fontSize: 10, color: GRIS, textAlign: 'center', marginBottom: 24 },
  seccion:    { marginBottom: 16 },
  secTitulo:  { fontSize: 9, fontFamily: 'Helvetica-Bold', color: GRIS, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, borderBottom: `1px solid ${BORDE}`, paddingBottom: 3 },
  fila:       { flexDirection: 'row', marginBottom: 4 },
  campo:      { width: 130, fontFamily: 'Helvetica-Bold', fontSize: 10 },
  valor:      { flex: 1, fontSize: 10 },
  parrafo:    { marginBottom: 8, textAlign: 'justify' },
  firmas:     { flexDirection: 'row', justifyContent: 'space-around', marginTop: 50 },
  firma:      { alignItems: 'center', width: 180 },
  lineaFirma: { borderTop: `1px solid #374151`, width: 180, marginBottom: 6 },
  firmaLabel: { fontSize: 9, color: GRIS, textAlign: 'center' },
  footer:     { position: 'absolute', bottom: 30, left: 50, right: 50, borderTop: `1px solid ${BORDE}`, paddingTop: 6 },
  footerText: { fontSize: 8, color: GRIS, textAlign: 'center' },
})

const TEXTO_BASE = `El/La paciente declara haber recibido información clara y comprensible sobre el procedimiento a realizar, sus beneficios esperados, los riesgos y complicaciones posibles, las alternativas terapéuticas disponibles, y las consecuencias de no recibir el tratamiento.

El/La paciente manifiesta que ha tenido la oportunidad de hacer preguntas y que todas han sido respondidas de manera satisfactoria por el/la odontólogo/a tratante.

El/La paciente otorga su consentimiento libre, voluntario e informado para la realización del procedimiento descrito, y autoriza al profesional a tomar las decisiones clínicas necesarias durante su ejecución.`

export default function ConsentimientoPDF({ datos }) {
  const { paciente, tratamiento, descripcion, fecha } = datos
  const fechaFormato = fecha
    ? format(new Date(fecha), "d 'de' MMMM 'de' yyyy", { locale: es })
    : '_______________'

  return (
    <Document title={`Consentimiento Informado - ${tratamiento}`}>
      <Page size="A4" style={s.page}>

        {/* Encabezado */}
        <Text style={s.titulo}>CONSENTIMIENTO INFORMADO</Text>
        <Text style={s.subtitulo}>ODONTOVAL — Sistema de Gestión Odontológica · odontoval.com.ec</Text>

        {/* Datos del paciente */}
        <View style={s.seccion}>
          <Text style={s.secTitulo}>Datos del paciente</Text>
          <View style={s.fila}>
            <Text style={s.campo}>Nombre completo:</Text>
            <Text style={s.valor}>{paciente?.apellidos}, {paciente?.nombres}</Text>
          </View>
          <View style={s.fila}>
            <Text style={s.campo}>Cédula de identidad:</Text>
            <Text style={s.valor}>{paciente?.cedula}</Text>
          </View>
          <View style={s.fila}>
            <Text style={s.campo}>Fecha:</Text>
            <Text style={s.valor}>{fechaFormato}</Text>
          </View>
        </View>

        {/* Tratamiento */}
        <View style={s.seccion}>
          <Text style={s.secTitulo}>Procedimiento a realizar</Text>
          <View style={s.fila}>
            <Text style={s.campo}>Tratamiento:</Text>
            <Text style={[s.valor, { fontFamily: 'Helvetica-Bold' }]}>{tratamiento}</Text>
          </View>
          {descripcion ? (
            <Text style={[s.parrafo, { marginTop: 6 }]}>{descripcion}</Text>
          ) : null}
        </View>

        {/* Declaración */}
        <View style={s.seccion}>
          <Text style={s.secTitulo}>Declaración de consentimiento</Text>
          <Text style={s.parrafo}>{TEXTO_BASE}</Text>
          <Text style={s.parrafo}>
            Este consentimiento puede ser revocado por el/la paciente en cualquier momento antes del inicio del procedimiento, sin que ello suponga perjuicio alguno en su atención futura.
          </Text>
        </View>

        {/* Firmas */}
        <View style={s.firmas}>
          <View style={s.firma}>
            <View style={s.lineaFirma} />
            <Text style={s.firmaLabel}>Firma del paciente / representante</Text>
            <Text style={[s.firmaLabel, { marginTop: 4 }]}>
              {paciente?.apellidos}, {paciente?.nombres}
            </Text>
            <Text style={[s.firmaLabel, { marginTop: 2 }]}>C.I.: {paciente?.cedula}</Text>
          </View>
          <View style={s.firma}>
            <View style={s.lineaFirma} />
            <Text style={s.firmaLabel}>Firma del profesional tratante</Text>
            <Text style={[s.firmaLabel, { marginTop: 4 }]}>Odontólogo/a ODONTOVAL</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>
            Documento generado por ODONTOVAL · {fechaFormato} · Este documento tiene validez legal una vez firmado por ambas partes.
          </Text>
        </View>
      </Page>
    </Document>
  )
}
