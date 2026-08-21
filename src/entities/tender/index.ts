export {
  ROWS, STATUS, STATUS_IDS, FACETS, EMPTY_FILTERS,
  activeCount, applyFilters, bidsDue, panelCount, tenderById, tenderPath,
  type BidsDue, type DueMode, type Filters, type StatusId, type TenderRow,
} from './model/registry';
export {
  BID_STATUS, bidStatus, flatten,
  decimal, groupSum, money, rankBids, spread, sumOf,
  type Bid, type BidStatusId, type Comparison, type ComparePosition, type Contractor,
  type PositionGroup,
} from './model/comparison';
/* Демо-данные — отдельным импортом и с отдельным именем: подменить их ответом
   API значит убрать ровно эту строку и то место, где её берут. */
export { MOCK_COMPARISON } from './model/comparison.mock';
