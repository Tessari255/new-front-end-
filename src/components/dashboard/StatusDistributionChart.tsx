import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import type { StatusMovimentacao } from '@/types'
import { rotuloStatusMovimentacao } from '@/lib/rotulos'

const CORES: Record<StatusMovimentacao, string> = {
  rascunho: '#94A3B8',
  em_andamento: '#2563EB',
  devolvida: '#D97706',
  reprovada: '#DC2626',
  aprovada: '#16A34A',
  cancelada: '#64748B',
}

const ORDEM: StatusMovimentacao[] = ['em_andamento', 'aprovada', 'devolvida', 'reprovada', 'rascunho', 'cancelada']

export function StatusDistributionChart({ distribuicao }: { distribuicao: Record<StatusMovimentacao, number> }) {
  const navigate = useNavigate()
  const dados = ORDEM.map((status) => ({ status, rotulo: rotuloStatusMovimentacao(status), total: distribuicao[status] }))
  const total = dados.reduce((acc, d) => acc + d.total, 0)

  if (total === 0) {
    return <p className="py-8 text-center text-sm text-[var(--color-ink-muted)]">Nenhuma movimentação registrada ainda.</p>
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }} barSize={18}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E4E7EC" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: '#57616C' }} axisLine={{ stroke: '#E4E7EC' }} tickLine={false} />
          <YAxis
            type="category"
            dataKey="rotulo"
            width={100}
            tick={{ fontSize: 12.5, fill: '#17212B' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(23,33,43,0.04)' }}
            formatter={(value) => [`${value} solicitação(ões)`, '']}
            labelFormatter={() => ''}
            contentStyle={{ borderRadius: 10, border: '1px solid #E4E7EC', fontSize: 13 }}
          />
          <Bar
            dataKey="total"
            radius={[0, 6, 6, 0]}
            cursor="pointer"
            onClick={(_data, index) => navigate(`/movimentacoes?status=${dados[index]!.status}`)}
          >
            {dados.map((d) => (
              <Cell key={d.status} fill={CORES[d.status]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
