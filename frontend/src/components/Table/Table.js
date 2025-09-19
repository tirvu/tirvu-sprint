import React, { useState, useEffect } from 'react';
import './Table.css';

const Table = ({ columns, data, onRowClick, actions }) => {
  // Inicializa com ordenação padrão pelo período (se existir coluna 'dates')
  const [sortConfig, setSortConfig] = useState(null);
  
  // Define a ordenação padrão pelo período quando o componente é montado
  useEffect(() => {
    // Procura pela coluna de período (dates)
    const datesColumn = columns.find(col => col.key === 'dates');
    if (datesColumn && !sortConfig) {
      // Define a ordenação padrão como ascendente (do mais antigo para o mais recente)
      // apenas se ainda não houver uma configuração de ordenação
      setSortConfig({ key: 'dates', direction: 'ascending' });
    }
  }, [columns, sortConfig]); // Executa quando as colunas mudam ou a configuração de ordenação muda
  
  // Função para ordenar os dados
  const sortedData = React.useMemo(() => {
    let sortableData = [...data];
    if (sortConfig !== null) {
      sortableData.sort((a, b) => {
        // Se a coluna tem uma função de ordenação personalizada, use-a
        if (columns.find(col => col.key === sortConfig.key)?.sortValue) {
          const sortValueFn = columns.find(col => col.key === sortConfig.key).sortValue;
          const aValue = sortValueFn(a);
          const bValue = sortValueFn(b);
          
          if (aValue < bValue) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (aValue > bValue) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        } else {
          // Ordenação padrão
          if (a[sortConfig.key] < b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? -1 : 1;
          }
          if (a[sortConfig.key] > b[sortConfig.key]) {
            return sortConfig.direction === 'ascending' ? 1 : -1;
          }
          return 0;
        }
      });
    }
    return sortableData;
  }, [data, sortConfig, columns]);

  // Função para lidar com o clique no cabeçalho da coluna para ordenação
  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  // Função para obter a classe de ordenação
  const getSortDirectionClass = (key) => {
    if (!sortConfig) {
      return '';
    }
    return sortConfig.key === key ? sortConfig.direction : '';
  };
  return (
    <div className="responsive-table-container">
      <table className="responsive-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th 
                key={column.key} 
                onClick={() => column.sortable !== false ? requestSort(column.key) : null}
                className={`${column.sortable !== false ? 'sortable-header' : ''} ${getSortDirectionClass(column.key)}`}
              >
                {column.header}
                {column.sortable !== false && (
                  <span className="sort-icon">
                    {sortConfig && sortConfig.key === column.key ? 
                      (sortConfig.direction === 'ascending' ? ' ▲' : ' ▼') : ' ⇅'}
                  </span>
                )}
              </th>
            ))}
            {actions && <th className="actions-column">Ações</th>}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="no-data">
                Nenhum dado encontrado
              </td>
            </tr>
          ) : (
            sortedData.map((row, index) => (
              <tr 
                key={row.id || index} 
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={onRowClick ? 'clickable-row' : ''}
              >
                {columns.map((column) => (
                  <td key={`${row.id || index}-${column.key}`} data-label={column.header}>
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
                {actions && (
                  <td className="actions-cell">
                    {actions(row)}
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default Table;