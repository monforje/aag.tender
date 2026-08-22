import { useState } from 'react';
import { PageHeader, PageTitle, Screen, SecondaryHeader } from 'clickup-shell';
/** variant="header" — второй слот шапки: срез одних и тех же данных. */
export const InHeader = () => {
  const [tab, setTab] = useState('active');
  return (
    <Screen>
      <PageHeader withSecondary><PageTitle>Реестр тендеров</PageTitle></PageHeader>
      <SecondaryHeader
        tabs={[{ id: 'active', label: 'Активные' }, { id: 'closed', label: 'Закрытые' }, { id: 'drafts', label: 'Черновики' }]}
        activeId={tab}
        onChange={setTab}
      />
    </Screen>
  );
};
/** variant="canvas" — та же полоса на холсте страницы: разделы карточки. */
export const OnCanvas = () => {
  const [tab, setTab] = useState('compare');
  return (
    <Screen>
      <SecondaryHeader
        variant="canvas"
        tabs={[
          { id: 'compare', label: 'Сравнение' },
          { id: 'questions', label: 'Вопросы' },
          { id: 'bids', label: 'Предложения' },
          { id: 'activity', label: 'Активность' },
        ]}
        activeId={tab}
        onChange={setTab}
      />
    </Screen>
  );
};
