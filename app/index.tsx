import { AppStoreProvider } from '@/src/store/AppStore';
import { PwrlftngApp } from '@/src/PwrlftngApp';

export default function Index() { return <AppStoreProvider><PwrlftngApp /></AppStoreProvider>; }
