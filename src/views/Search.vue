<script>
export default {
  name: 'Search',
  data() {
    return {
      isLoading: true,
      data: [],
      searchinput: '',
      first: true,
    };
  },
  created() {
    this.$ipcRenderer.on('search data', (data) => {
      this.isLoading = false;
      this.data = data;
    });
  },
  methods: {
    toFixed(num, fixed) {
      // https://stackoverflow.com/questions/4187146 소수점자리 0 안 남기고 자르기
      // eslint-disable-next-line prefer-template
      const re = new RegExp('^-?\\d+(?:.\\d{0,' + (fixed || -1) + '})?');
      return parseFloat(num.toString().match(re)[0]);
    },
    parseViews(view) {
      const v = String(view);
      const l = String(view).length;

      if (l > 8) { // 억 단위
        if (l === 9) return `${this.toFixed((view / 100000000), 1)}억`; // 억 단위 소수점
        return `${Math.floor(view / 100000000)}억`;
      }
      if (l > 4) { // 천만 ~ 만 단위
        if (l === 5) return `${this.toFixed((view / 10000), 1)}만`; // 만 단위 소수점 처리
        return `${v.substring(0, l - 4)}만`; // 이외는 그냥 만 붙여서 리턴
      }
      if (l === 4) return `${this.toFixed((view / 1000), 1)}천`; // 천 단위 소수점 처리
      return v;
    },
    search() {
      if (this.searchinput === '') alert('검색어를 입력해주세요');
      else {
        this.isLoading = true;
        this.first = false;
        this.$ipcRenderer.send('search', this.searchinput);
      }
    },
  },
};
</script>

<template lang="pug">
#search
  #searchnavbar
    icon(:icon="['fab','youtube']" size="lg" style="color: red;background:linear-gradient(white,white) center center/20% 70% no-repeat;")
    input.search-input(placeholder="검색어" v-model="searchinput" @keyup.enter="search")
    button.search-button(@click="search") 검색
  .ui.loader.active.inline.small(v-if="isLoading && !first")
  .search-first(v-if="first") 원하는 영상을 검색한 후 다운로드 할 영상을 선택해주세요!
  #searchresult(v-if="!isLoading")
    .search-result-title "{{ data.correctedQuery }}" 검색결과 -  다운로드 할 영상 선택
    .search-card(v-for="v in data.items" :key="v.id")
      .search-image
        img.search-thumbnail(:src="v.bestThumbnail.url")
        .search-thumbnail-time {{ v.duration }}
      .search-info
        .search-title {{ v.title }}
        .search-channel
          img.search-avatar(:src="v.author.bestAvatar.url")
          .search-author {{ v.author.name }}
        .search-views 조회수 {{ parseViews(v.views) }}회 • 3개월 전

</template>

<style lang="scss">
#search, #searchresult {
  height: 100%;
}

#searchnavbar {
  border-bottom: 2px solid #4b4b4b;
  padding: 12px;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

#searchresult {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 12px 60px 12px;
  overflow-y: auto;
}

.ui.loader.inline {
  margin-top: 16px;
}

.search- {
  &input {
    border: 1px solid rgb(197, 197, 197);
    border-radius: 4px;
    padding: 8px;
    width: 50%;
    margin: 0 8px;
  }

  &button {
    padding: 8px 12px;
    border-radius: 4px;
    border: 0;
    background-color: #197cc7;
    color: white;
    font-weight: 700;
  }

  &first {
    font-size: 18px;
    text-align: center;
    margin-top: 12px;
  }

  &result-title {
    font-size: 20px;
    font-weight: 700;
    margin-bottom: 12px;
    text-align: left;
  }

  &card {
    display: flex;
    flex-direction: row;
    align-items: center;
    width: 100%;
    margin-bottom: 16px;
    z-index: 1;

    &:hover {
      filter: brightness(50%);
      background-color: rgba(0,0,0,0.5)
    }
  }

  &image {
    flex-shrink: 0;
    width: 45%;
    position: relative
  }

  &thumbnail {
    width: 100%;

    &-time {
      position: absolute;
      bottom: 0;
      right: 0;
      margin: 4px;
      padding: 3px 4px;
      background-color: rgba(0,0,0,0.8);
      color: white;
      font-size: 12px;
    }
  }

  &info {
    display: flex;
    flex-direction: column;
    margin-left: 12px;
    height: 100%;
    justify-content: space-between;

  }

  &title {
    font-size: 15px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    text-align: left;
    margin-bottom: 10px;
  }

  &views, &author {
    // margin-top: 4px;
    font-size: 13px;
    text-align: left;
    color: #474747;
  }

  &views {
    margin-top: 4px;
  }

  &channel {
    display: flex;
    flex-direction: row;
    align-items: center;
  }

  &avatar {
    width: 20px;
    margin-right: 4px;
    border-radius: 50%;
  }
}

</style>
