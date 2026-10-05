import { useEffect, useMemo } from 'react';
import Link from './link';

function Header() {
  const siteName = useMemo(() => {
    // 优先从环境变量读取
    if (process.env.REACT_APP_SITE_NAME) {
      return process.env.REACT_APP_SITE_NAME;
    }
    return window.Config?.SiteName || '站点监控';
  }, []);

  const navi = useMemo(() => {
    return window.Config?.Navi || [];
  }, []);

  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  return (
    <div id='header'>
      <div className='container'>
        <h1 className='logo'>{siteName}</h1>
        <div className='navi'>
          {navi.map((item, index) => (
            <Link key={index} to={item.url} text={item.text} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default Header;
