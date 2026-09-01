{{- define "canarypilot.name" -}}
{{- .Chart.Name -}}
{{- end -}}

{{- define "canarypilot.namespace" -}}
{{- .Release.Namespace -}}
{{- end -}}
